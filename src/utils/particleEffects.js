import * as THREE from "three";

export class ParticleEffect {
  constructor(scene, x, y, type = "flower") {
    this.scene = scene;
    this.type = type;
    this.particles = [];
    this.lifetime = 0;
    this.maxLifetime = 120; // frames

    this.createParticles(x, y, type);
  }

  createParticles(x, y, type) {
    const particleCount = type === "flower" ? 15 : 20;

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.BufferGeometry();

      if (type === "flower") {
        // Create flower petal
        const petalGeometry = new THREE.ConeGeometry(0.15, 0.4, 8);
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color().setHSL(Math.random() * 0.3 + 0.8, 0.8, 0.6),
          emissive: new THREE.Color().setHSL(
            Math.random() * 0.3 + 0.8,
            0.8,
            0.4
          ),
        });
        const mesh = new THREE.Mesh(petalGeometry, material);

        mesh.position.set(
          x + (Math.random() - 0.5) * 2,
          y + (Math.random() - 0.5) * 2,
          0
        );
        mesh.rotation.z = Math.random() * Math.PI * 2;

        this.scene.add(mesh);

        this.particles.push({
          mesh,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2 - 0.1,
          vz: (Math.random() - 0.5) * 0.1,
          rotVx: (Math.random() - 0.5) * 0.1,
          rotVy: (Math.random() - 0.5) * 0.1,
          rotVz: (Math.random() - 0.5) * 0.1,
        });
      } else {
        // Create heart shape
        const heartGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshPhongMaterial({
          color: new THREE.Color(1, 0.2, 0.4),
          emissive: new THREE.Color(1, 0.2, 0.4),
        });
        const mesh = new THREE.Mesh(heartGeometry, material);

        mesh.position.set(
          x + (Math.random() - 0.5) * 3,
          y + (Math.random() - 0.5) * 3,
          0
        );

        this.scene.add(mesh);

        this.particles.push({
          mesh,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15 - 0.1,
          vz: (Math.random() - 0.5) * 0.08,
          rotVx: (Math.random() - 0.5) * 0.08,
          rotVy: (Math.random() - 0.5) * 0.08,
          rotVz: (Math.random() - 0.5) * 0.08,
        });
      }
    }
  }

  update() {
    this.lifetime++;
    const progress = this.lifetime / this.maxLifetime;

    this.particles.forEach((particle) => {
      // Update position
      particle.mesh.position.x += particle.vx;
      particle.mesh.position.y += particle.vy;
      particle.mesh.position.z += particle.vz;

      // Apply gravity
      particle.vy -= 0.01;

      // Update rotation
      particle.mesh.rotation.x += particle.rotVx;
      particle.mesh.rotation.y += particle.rotVy;
      particle.mesh.rotation.z += particle.rotVz;

      // Fade out
      particle.mesh.material.opacity = 1 - progress;
      particle.mesh.material.transparent = true;
    });

    return this.lifetime < this.maxLifetime;
  }

  dispose() {
    this.particles.forEach((particle) => {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.mesh.material.dispose();
    });
  }
}
