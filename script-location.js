function getHighAccuracyLocation() {
  const options = {
    enableHighAccuracy: true, // Forces GPS/Wi-Fi usage over IP/Cell triangulation
    timeout: 10000, // Wait up to 10 seconds for a lock
    maximumAge: 0, // Do not use a cached position
  };

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const accuracy = position.coords.accuracy; // Accuracy in meters

      console.log(`Latitude: ${lat}`);
      console.log(`Longitude: ${lon}`);
      console.log(`Accuracy: Within ${accuracy} meters`);

      console.log(
        `Open in Google Maps: https://www.google.com/maps?q=${lat},${lon}`
      );
    },
    (error) => {
      console.error("❌ Error fetching location:", error.message);
    },
    options // Pass the options object here
  );
}

getHighAccuracyLocation();
