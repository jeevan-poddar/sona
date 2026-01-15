function getLocation() {
  const result = document.getElementById("result");

  if (!navigator.geolocation) {
    result.innerHTML = "Geolocation is not supported by your browser.";
    return;
  }

  result.innerHTML = "Requesting location...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      result.innerHTML = `
            ✅ Location received <br><br>
            Latitude: <b>${lat}</b><br>
            Longitude: <b>${lon}</b><br><br>
            <a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank">
              Open in Google Maps
            </a>
          `;
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        result.innerHTML = "❌ Permission denied.";
      } else {
        result.innerHTML = "❌ Unable to fetch location.";
      }
    }
  );
}
