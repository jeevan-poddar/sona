const getLocation = () => {
  // get the user location with ip address
  fetch("https://ipapi.co/json/")
    .then((response) => response.json())
    .then((data) => {
        document.querySelector("p");
        const des = document.getElementById("result");
        des.innerHTML = `Latitude: ${data.latitude} Longitude: ${data.longitude}`;
      console.log(`Latitude: ${data.latitude} Longitude: ${data.longitude}`);
    });
};
getLocation();
