// Navigation
const tabs = document.querySelectorAll('.sidebar li');
const pages = document.querySelectorAll('.page');

function switchTab(targetId) {
    tabs.forEach(t => t.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));
    
    const activeTab = Array.from(tabs).find(t => t.getAttribute('data-target') === targetId);
    if (activeTab) activeTab.classList.add('active');
    
    const activePage = document.getElementById(targetId);
    if (activePage) activePage.classList.add('active');

    if (targetId === 'simulation') {
        resizeThree();
    }
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        switchTab(tab.getAttribute('data-target'));
    });
});

// Three.js Setup
const container = document.getElementById('three-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f18);
scene.fog = new THREE.Fog(0x0a0f18, 15, 60);

const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 150);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// OrbitControls (Third Person)
let controls;
if (typeof THREE.OrbitControls !== 'undefined') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below floor
    controls.minDistance = 2;
    controls.maxDistance = 15;
}

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1.2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 30, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
const d = 30;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

const pointLight = new THREE.PointLight(0x00f2fe, 1, 20);
scene.add(pointLight); // Will follow drone

// Detailed Environment
const roomSize = 50;
const obstacles = [];
const colliders = []; // For Box3 collision

// Floor
const floorGeo = new THREE.PlaneGeometry(roomSize, roomSize);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.9, metalness: 0.1 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const gridHelper = new THREE.GridHelper(roomSize, 50, 0x00f2fe, 0x334155);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// Walls
const wallGeo = new THREE.BoxGeometry(roomSize, 12, 1);
const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
const wallPositions = [
    {x: 0, z: -roomSize/2}, {x: 0, z: roomSize/2}, 
    {x: -roomSize/2, z: 0, rotY: Math.PI/2}, {x: roomSize/2, z: 0, rotY: Math.PI/2}
];
wallPositions.forEach(wp => {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(wp.x, 6, wp.z);
    if(wp.rotY) wall.rotation.y = wp.rotY;
    wall.receiveShadow = true;
    scene.add(wall);
    colliders.push(new THREE.Box3().setFromObject(wall));
});

// Pillars & Boxes
const obsMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x475569 }),
    new THREE.MeshStandardMaterial({ color: 0x334155 }),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
];

for(let i=0; i<15; i++) {
    let w = 1 + Math.random() * 3;
    let h = 2 + Math.random() * 8;
    let d = 1 + Math.random() * 3;
    let geo = new THREE.BoxGeometry(w, h, d);
    let mesh = new THREE.Mesh(geo, obsMaterials[Math.floor(Math.random()*obsMaterials.length)]);
    
    mesh.position.x = (Math.random() - 0.5) * (roomSize - 10);
    mesh.position.z = (Math.random() - 0.5) * (roomSize - 10);
    mesh.position.y = h / 2;
    
    // Ensure center is free for spawn
    if (Math.abs(mesh.position.x) < 4 && Math.abs(mesh.position.z) < 4) continue;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    obstacles.push(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
}

// Drone Model
const droneGroup = new THREE.Group();
const dronePitchRollGroup = new THREE.Group(); // Inner group for tilting

const bodyGeo = new THREE.BoxGeometry(0.8, 0.2, 0.8);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.5, roughness: 0.2 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.castShadow = true;
dronePitchRollGroup.add(body);

const props = [];
const armPositions = [
    {x: 0.5, z: 0.5}, {x: -0.5, z: 0.5}, {x: 0.5, z: -0.5}, {x: -0.5, z: -0.5}
];

armPositions.forEach(pos => {
    // Arm
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(pos.x, 0, pos.z);
    arm.rotation.x = Math.PI / 2;
    if (pos.x * pos.z < 0) arm.rotation.y = Math.PI / 4;
    else arm.rotation.y = -Math.PI / 4;
    
    // Motor
    const motorGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15);
    const motor = new THREE.Mesh(motorGeo, armMat);
    motor.position.set(pos.x * 1.3, 0.05, pos.z * 1.3);
    
    // Propeller
    const propGeo = new THREE.BoxGeometry(0.6, 0.01, 0.06);
    const propMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, transparent: true, opacity: 0.8 });
    const prop = new THREE.Mesh(propGeo, propMat);
    prop.position.set(pos.x * 1.3, 0.15, pos.z * 1.3);
    props.push(prop);
    
    dronePitchRollGroup.add(arm);
    dronePitchRollGroup.add(motor);
    dronePitchRollGroup.add(prop);
});

// Front Indicator
const frontGeo = new THREE.BoxGeometry(0.3, 0.1, 0.1);
const frontMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
const front = new THREE.Mesh(frontGeo, frontMat);
front.position.set(0, 0.1, -0.4);
dronePitchRollGroup.add(front);

droneGroup.add(dronePitchRollGroup);
droneGroup.position.set(0, 0.2, 0); // Ground level
scene.add(droneGroup);

// Collision Box for Drone
const droneCollider = new THREE.Box3();

// Trajectory Trail
const maxTrailPoints = 300;
const trailGeo = new THREE.BufferGeometry();
const trailPositions = new Float32Array(maxTrailPoints * 3);
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
const trailMat = new THREE.LineBasicMaterial({ color: 0x00f2fe, linewidth: 2, transparent: true, opacity: 0.6 });
const trail = new THREE.Line(trailGeo, trailMat);
scene.add(trail);
let trailIndex = 0;

// Camera state
let isFPV = false;
let cameraOffset = new THREE.Vector3(0, 3, 6);

// Physics & Controls State
let dronePos = new THREE.Vector3(0, 0.2, 0);
let droneVel = new THREE.Vector3(0, 0, 0);
let droneRot = 0; // Yaw
let targetPitch = 0;
let targetRoll = 0;
let currentPitch = 0;
let currentRoll = 0;

let flightTime = 0;
let distanceTravelled = 0;
let isRunning = false;
let isDemo = false;

const droneParams = {
    acceleration: 20.0,
    maxSpeed: 8.0,
    maxSpeedBoost: 15.0,
    drag: 3.0,          // Air resistance / inertia
    verticalAcc: 10.0,
    turnSpeed: 2.5,
    maxTilt: 0.4
};

const keys = { w:false, a:false, s:false, d:false, q:false, e:false, shift:false };

window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if(keys.hasOwnProperty(k)) keys[k] = true;
    if(k === 'r') resetDrone();
});
window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if(keys.hasOwnProperty(k)) keys[k] = false;
});

function resetDrone() {
    dronePos.set(0, 0.2, 0);
    droneVel.set(0, 0, 0);
    droneRot = 0;
    currentPitch = 0;
    currentRoll = 0;
    trailIndex = 0;
    distanceTravelled = 0;
    flightTime = 0;
    for(let i=0; i<maxTrailPoints*3; i++) trailPositions[i] = 0;
    trail.geometry.attributes.position.needsUpdate = true;
    isDemo = false;
    isRunning = false;
    document.getElementById('btn-start').innerText = "Start";
}

// Minimap
const minimapCanvas = document.getElementById('minimap');
const ctx = minimapCanvas.getContext('2d');
minimapCanvas.width = 200;
minimapCanvas.height = 200;

function drawMinimap() {
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillStyle = 'rgba(10, 15, 24, 0.8)';
    ctx.fillRect(0, 0, 200, 200);
    
    ctx.fillStyle = '#475569';
    obstacles.forEach(obs => {
        const mx = (obs.position.x / roomSize) * 200 + 100;
        const my = (obs.position.z / roomSize) * 200 + 100;
        const w = (obs.geometry.parameters.width / roomSize) * 200;
        const d = (obs.geometry.parameters.depth / roomSize) * 200;
        ctx.fillRect(mx - w/2, my - d/2, w, d);
    });
    
    const dx = (dronePos.x / roomSize) * 200 + 100;
    const dy = (dronePos.z / roomSize) * 200 + 100;
    
    // Trail on minimap
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.beginPath();
    for(let i=0; i<maxTrailPoints; i++) {
        let px = trailPositions[i*3];
        let pz = trailPositions[i*3+2];
        if (px === 0 && pz === 0) continue;
        let mx = (px / roomSize) * 200 + 100;
        let my = (pz / roomSize) * 200 + 100;
        if(i===0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
    }
    ctx.stroke();

    ctx.fillStyle = '#00f2fe';
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Direction indicator
    ctx.strokeStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx + Math.sin(droneRot)*10, dy - Math.cos(droneRot)*10);
    ctx.stroke();
}

// UI Buttons
document.getElementById('btn-start').addEventListener('click', function() {
    isRunning = !isRunning;
    this.innerText = isRunning ? "Pause" : "Start";
    if (isRunning) isDemo = false;
});

document.getElementById('btn-camera').addEventListener('click', function() {
    isFPV = !isFPV;
    if(!isFPV && controls) {
        // Reset orbit controls target when going back to TPV
        camera.position.copy(dronePos).add(cameraOffset);
    }
});

document.getElementById('btn-demo').addEventListener('click', function() {
    resetDrone();
    isRunning = true;
    isDemo = true;
    document.getElementById('btn-start').innerText = "Pause";
});

// Charts Initialization
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';
const chartConfig = { responsive: true, maintainAspectRatio: false };

const posCtx = document.getElementById('posChart').getContext('2d');
const posChart = new Chart(posCtx, {
    type: 'scatter',
    data: { datasets: [{ label: 'Drone X-Z Trajectory', data: [], backgroundColor: '#00f2fe' }] },
    options: { ...chartConfig, scales: { x: { min: -25, max: 25 }, y: { min: -25, max: 25 } } }
});

const altCtx = document.getElementById('altChart').getContext('2d');
const altChart = new Chart(altCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Altitude (m)', data: [], borderColor: '#4ade80', tension: 0.1 },
            { label: 'Velocity (m/s)', data: [], borderColor: '#00f2fe', tension: 0.1 }
        ]
    },
    options: { ...chartConfig, scales: { x: { display: false } } }
});

const errCtx = document.getElementById('errChart').getContext('2d');
const errChart = new Chart(errCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{ label: 'Tracking Error (m)', data: [], borderColor: '#f87171', fill: true, backgroundColor: 'rgba(248, 113, 113, 0.2)' }]
    },
    options: { ...chartConfig, scales: { x: { display: false }, y: { min: 0, max: 0.1 } } }
});

// Update Loop
const clock = new THREE.Clock();
let demoTime = 0;
let lastPos = new THREE.Vector3();

function updatePhysics(dt) {
    if (!isRunning) {
        // Idling propellers
        props.forEach(p => p.rotation.y += 1 * dt);
        return;
    }

    // Propellers full speed
    props.forEach(p => p.rotation.y += 30 * dt);

    let currentMaxSpeed = keys.shift ? droneParams.maxSpeedBoost : droneParams.maxSpeed;
    
    // Demo Mode logic
    if (isDemo) {
        demoTime += dt;
        // Simple figure-8 route
        let targetRot = Math.sin(demoTime * 0.3) * Math.PI;
        keys.w = true; 
        keys.s = false; keys.a = false; keys.d = false;
        droneRot += (targetRot - droneRot) * dt * 2.0;
        
        let targetAlt = 4 + Math.sin(demoTime * 0.5) * 2;
        if (dronePos.y < targetAlt - 0.2) { keys.q = true; keys.e = false; }
        else if (dronePos.y > targetAlt + 0.2) { keys.e = true; keys.q = false; }
        else { keys.q = false; keys.e = false; }
    } else {
        if (keys.a) droneRot += droneParams.turnSpeed * dt;
        if (keys.d) droneRot -= droneParams.turnSpeed * dt;
    }

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), droneRot);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), droneRot);

    // Apply Acceleration
    let acc = new THREE.Vector3(0, 0, 0);
    if (keys.w) acc.add(forward.clone().multiplyScalar(droneParams.acceleration));
    if (keys.s) acc.add(forward.clone().multiplyScalar(-droneParams.acceleration));
    
    if (keys.q) acc.y += droneParams.verticalAcc;
    if (keys.e) acc.y -= droneParams.verticalAcc;

    // Apply Gravity/Hover logic (if not ascending/descending, hover)
    if (!keys.q && !keys.e) {
        // Dampen Y velocity
        droneVel.y -= droneVel.y * droneParams.drag * dt;
    }

    // Apply Drag (Friction) for XZ
    let velXZ = new THREE.Vector2(droneVel.x, droneVel.z);
    velXZ.sub(velXZ.clone().multiplyScalar(droneParams.drag * dt));
    droneVel.x = velXZ.x;
    droneVel.z = velXZ.y;

    // Add Acceleration to Velocity
    droneVel.add(acc.clone().multiplyScalar(dt));

    // Clamp speed
    let currentSpeedXZ = new THREE.Vector2(droneVel.x, droneVel.z).length();
    if (currentSpeedXZ > currentMaxSpeed) {
        let clamped = new THREE.Vector2(droneVel.x, droneVel.z).normalize().multiplyScalar(currentMaxSpeed);
        droneVel.x = clamped.x;
        droneVel.z = clamped.y;
    }

    // Calculate Next Position
    let nextPos = dronePos.clone().add(droneVel.clone().multiplyScalar(dt));

    // Collision Detection
    droneGroup.position.copy(nextPos);
    droneCollider.setFromObject(body); // Simple box collider for the body
    
    let isCollision = false;
    let isWarning = false;

    for(let col of colliders) {
        if (droneCollider.intersectsBox(col)) {
            isCollision = true;
            break;
        }
        // Distance check for warning
        if (col.distanceToPoint(dronePos) < 3.0) {
            isWarning = true;
        }
    }

    // Boundary constraints
    if (nextPos.y < 0.2) { nextPos.y = 0.2; droneVel.y = 0; }
    if (nextPos.y > 11) { nextPos.y = 11; droneVel.y = 0; }
    
    const warnEl = document.getElementById('obstacle-warning');
    if (isCollision) {
        // Bounce back / stop
        droneVel.multiplyScalar(-0.5); 
        droneGroup.position.copy(dronePos); // Revert
        warnEl.classList.remove('hidden');
        warnEl.innerText = "COLLISION DETECTED!";
        warnEl.style.backgroundColor = "rgba(220, 38, 38, 0.9)";
    } else {
        distanceTravelled += dronePos.distanceTo(nextPos);
        dronePos.copy(nextPos);
        
        if (isWarning) {
            warnEl.classList.remove('hidden');
            warnEl.innerText = "OBSTACLE PROXIMITY WARNING";
            warnEl.style.backgroundColor = "rgba(248, 113, 113, 0.9)";
        } else {
            warnEl.classList.add('hidden');
        }
    }

    droneGroup.position.copy(dronePos);
    
    // Dynamic Tilt (Pitch and Roll) based on velocity relative to rotation
    let localVel = droneVel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -droneRot);
    targetPitch = (localVel.z / currentMaxSpeed) * droneParams.maxTilt; 
    targetRoll = (localVel.x / currentMaxSpeed) * droneParams.maxTilt;

    currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, 0.1);
    currentRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, 0.1);
    
    droneGroup.rotation.y = droneRot;
    dronePitchRollGroup.rotation.set(currentPitch, 0, currentRoll, 'XYZ');

    // Trail update
    if (lastPos.distanceTo(dronePos) > 0.2) {
        trailPositions[trailIndex*3] = dronePos.x;
        trailPositions[trailIndex*3+1] = dronePos.y;
        trailPositions[trailIndex*3+2] = dronePos.z;
        trailIndex = (trailIndex + 1) % maxTrailPoints;
        trail.geometry.attributes.position.needsUpdate = true;
        lastPos.copy(dronePos);
    }

    pointLight.position.copy(dronePos);
    flightTime += dt;
}

function updateDashboard() {
    let x = dronePos.x.toFixed(2);
    let y = dronePos.y.toFixed(2);
    let z = dronePos.z.toFixed(2);
    let v = droneVel.length().toFixed(2);
    let h = ((droneRot * 180 / Math.PI) % 360);
    if(h < 0) h += 360;
    
    // HUD overlay
    document.getElementById('hud-x').innerText = x;
    document.getElementById('hud-y').innerText = y;
    document.getElementById('hud-z').innerText = z;
    document.getElementById('hud-alt').innerText = y;
    document.getElementById('hud-spd').innerText = v;
    document.getElementById('hud-hdg').innerText = h.toFixed(0);

    // Dashboard page
    document.getElementById('tel-x').innerText = x;
    document.getElementById('tel-y').innerText = y;
    document.getElementById('tel-z').innerText = z;
    document.getElementById('tel-v').innerText = v;
    document.getElementById('tel-h').innerText = h.toFixed(0);
    document.getElementById('tel-d').innerText = distanceTravelled.toFixed(2);
    
    let mins = Math.floor(flightTime / 60);
    let secs = Math.floor(flightTime % 60);
    document.getElementById('tel-t').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('tel-status').innerText = isRunning ? "Flying" : (dronePos.y <= 0.2 ? "Landed" : "Hovering");

    // Simulated IMU with physics fidelity
    let gForce = 9.81 + (droneVel.y - (lastPos.y || 0)) * 10;
    let localVel = droneVel.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -droneRot);
    
    document.getElementById('imu-ax').innerText = (localVel.x * 1.5 + (Math.random()-0.5)*0.1).toFixed(2);
    document.getElementById('imu-ay').innerText = (gForce + (Math.random()-0.5)*0.1).toFixed(2);
    document.getElementById('imu-az').innerText = (localVel.z * 1.5 + (Math.random()-0.5)*0.1).toFixed(2);
    
    document.getElementById('imu-gx').innerText = currentPitch.toFixed(3);
    document.getElementById('imu-gy').innerText = ((keys.a ? 0.5 : 0) - (keys.d ? 0.5 : 0)).toFixed(3);
    document.getElementById('imu-gz').innerText = currentRoll.toFixed(3);

    let err = 0.005 + Math.random() * 0.015 + (droneVel.length() > 3 ? 0.02 : 0);
    document.getElementById('fusion-error').innerText = err.toFixed(3);

    drawMinimap();
}

let chartUpdateTimer = 0;
function updateCharts(dt) {
    if (!isRunning) return;
    chartUpdateTimer += dt;
    if (chartUpdateTimer > 1) { // Update every 1s
        chartUpdateTimer = 0;
        let tStr = Math.floor(flightTime).toString();
        
        posChart.data.datasets[0].data.push({ x: dronePos.x, y: dronePos.z });
        if (posChart.data.datasets[0].data.length > 50) posChart.data.datasets[0].data.shift();
        posChart.update();

        altChart.data.labels.push(tStr);
        altChart.data.datasets[0].data.push(dronePos.y);
        altChart.data.datasets[1].data.push(droneVel.length());
        if (altChart.data.labels.length > 20) {
            altChart.data.labels.shift();
            altChart.data.datasets[0].data.shift();
            altChart.data.datasets[1].data.shift();
        }
        altChart.update();

        errChart.data.labels.push(tStr);
        errChart.data.datasets[0].data.push(parseFloat(document.getElementById('fusion-error').innerText));
        if (errChart.data.labels.length > 20) {
            errChart.data.labels.shift();
            errChart.data.datasets[0].data.shift();
        }
        errChart.update();
    }
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    updatePhysics(dt);
    updateDashboard();
    updateCharts(dt);

    if (isFPV) {
        // First-person view inside the drone
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), droneRot);
        camera.position.copy(dronePos).add(new THREE.Vector3(0, 0.1, 0));
        camera.lookAt(dronePos.clone().add(forward));
        if(controls) controls.enabled = false;
    } else {
        if(controls) {
            controls.enabled = true;
            controls.target.copy(dronePos);
            controls.update();
        } else {
            // Fallback simple follow
            let idealOffset = cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), droneRot);
            camera.position.lerp(dronePos.clone().add(idealOffset), 0.1);
            camera.lookAt(dronePos);
        }
    }

    renderer.render(scene, camera);
}

function resizeThree() {
    if (!container.clientWidth) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

window.addEventListener('resize', resizeThree);

// Init
resetDrone();
animate();
