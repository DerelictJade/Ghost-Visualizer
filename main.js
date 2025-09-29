class FramePoint {
    constructor(position, time) {
        this.position = position;
        this.time = time;
    }
}

class Ghost {
    constructor(framePoints, levelId, time, frameCount, color = null, name = "Unnamed Ghost") {
        this.framePoints = framePoints;
        this.levelId = levelId;
        this.time = time;
        this.frameCount = frameCount;
        this.name = name;
        this.color = color || new THREE.Color(Math.random(), Math.random(), Math.random());
        this.group = null;
        this.animationSphere = null;
        this.uiElement = null;
    }
}

const App = {
    scene: null,
    camera: null,
    renderer: null,
    ghosts: [],
    scale: { x: 1, y: 2, z: 1 },
    offset: { x: 0, y: 0, z: 0 },

    animation: {
        time: 0,
        running: false,
        lastTime: null,
        duration: 0
    },

    timeScale: 1.0,
    keys: {},
    playBtnDeb: false,

    init: function () {
        this.setupThreeJS();
        this.setupFileInput();
        this.setupSettings();
        this.animate();
        window.addEventListener('resize', () => this.onResize());
    },

    setupSettings: function () {
        const offsetX = document.getElementById("offsetX");
        const offsetY = document.getElementById("offsetY");
        const offsetZ = document.getElementById("offsetZ");

        const scaleX = document.getElementById("scaleX");
        const scaleY = document.getElementById("scaleY");
        const scaleZ = document.getElementById("scaleZ");

        const timeScaleSlider = document.getElementById("timeScale");
        const timeScaleValue = document.getElementById("timeScaleValue");

        offsetX.addEventListener("input", () => {
            document.getElementById("offsetXValue").textContent = offsetX.value;
            this.setGridOffset();
        });
        offsetY.addEventListener("input", () => {
            document.getElementById("offsetYValue").textContent = offsetY.value;
            this.setGridOffset();
        });
        offsetZ.addEventListener("input", () => {
            document.getElementById("offsetZValue").textContent = offsetZ.value;
            this.setGridOffset();
        });

        scaleX.addEventListener("input", () => {
            document.getElementById("scaleXValue").textContent = scaleX.value;
            this.setGridScale();
        });
        scaleY.addEventListener("input", () => {
            document.getElementById("scaleYValue").textContent = scaleY.value;
            this.setGridScale();
        });
        scaleZ.addEventListener("input", () => {
            document.getElementById("scaleZValue").textContent = scaleZ.value;
            this.setGridScale();
        });

        timeScaleSlider.addEventListener("input", () => {
            this.timeScale = parseFloat(timeScaleSlider.value);
            timeScaleValue.textContent = this.timeScale.toFixed(2);
        });

        document.getElementById("playPauseBtn").addEventListener("click", () => { if (!this.playBtnDeb) this.toggleAnimation() });

        document.getElementById("animationSlider").addEventListener("input", (e) => {
            this.animation.time = parseFloat(e.target.value);
            this.animation.running = false;
            document.getElementById("playPauseBtn").textContent = "Play";
            document.getElementById("timer").textContent = this.animation.time.toFixed(3) + "s";
        });

        document.addEventListener("keydown", e => this.keys[e.code] = true);
        document.addEventListener("keyup", e => this.keys[e.code] = false);
    },

    setGridOffset: function () {
        this.offset.x = parseFloat(document.getElementById("offsetX").value);
        this.offset.y = parseFloat(document.getElementById("offsetY").value);
        this.offset.z = parseFloat(document.getElementById("offsetZ").value);
        this.updatePointClouds();
    },

    setGridScale: function () {
        this.scale.x = parseFloat(document.getElementById("scaleX").value);
        this.scale.y = parseFloat(document.getElementById("scaleY").value);
        this.scale.z = parseFloat(document.getElementById("scaleZ").value);
        this.updatePointClouds();
    },

    addGhostUI: function (ghost) {
        const container = document.getElementById("ghostList");

        const div = document.createElement("div");
        div.className = "ghost-card";

        const labelInput = document.createElement("input");
        labelInput.type = "text";
        labelInput.value = ghost.name;
        labelInput.placeholder = "Label ghost...";
        labelInput.addEventListener("input", () => {
            ghost.name = labelInput.value;
        });
        div.appendChild(labelInput);

        const timeP = document.createElement("p");
        timeP.textContent = `Time: ${ghost.time.toFixed(5)}`;
        div.appendChild(timeP);

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = "#" + ghost.color.toString(16).padStart(6, "0");
        colorInput.addEventListener("input", () => {
            ghost.color = parseInt(colorInput.value.replace("#", "0x"));
            this.updatePointClouds();
        });
        div.appendChild(colorInput);

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.addEventListener("click", () => {
            this.removeGhost(ghost);
            container.removeChild(div);
        });
        div.appendChild(removeBtn);

        ghost.uiElement = div;
        container.appendChild(div);
    },

    updateDuration: function () {
        this.animation.duration = Math.max(...this.ghosts.map(g => g.framePoints[g.frameCount - 1].time || 0));
        document.getElementById("animationSlider").max = this.animation.duration;
    },

    toggleAnimation: function () {
        if (this.animation.time >= this.animation.duration)
            this.animation.time = 0.0;

        this.animation.running = !this.animation.running;
        document.getElementById("playPauseBtn").textContent = this.animation.running ? "Pause" : "Play";
        if (this.animation.running) this.animation.lastTime = performance.now();
    },

    updateCameraWASD: function () {
        const speed = 0.1;

        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, this.camera.up).normalize();

        const move = new THREE.Vector3();
        if (this.keys["KeyS"]) move.sub(forward);
        if (this.keys["KeyA"]) move.sub(right);
        if (this.keys["KeyD"]) move.add(right);
        if (this.keys["KeyW"]) move.add(forward);

        this.camera.position.add(move);
        this.controls.target.add(move);

        if (this.keys["Space"]) {
            if (!this.playBtnDeb) {
                this.playBtnDeb = true;
                this.toggleAnimation();
            }
        } else {
            this.playBtnDeb = false;
        }
    },

    updateTimer: function () {
        if (this.animation.running) {
            const now = performance.now();
            const delta = (now - this.animation.lastTime) / 1000;
            this.animation.lastTime = now;
            this.animation.time += delta * this.timeScale;
            if (this.animation.time > this.animation.duration) {
                this.animation.time = this.animation.duration;
                this.animation.running = false;
                document.getElementById("playPauseBtn").textContent = "Play";
            }
        }
        document.getElementById("timer").textContent = this.animation.time.toFixed(3) + "s";
        document.getElementById("animationSlider").value = this.animation.time;
    },

    setupThreeJS: function () {
        const viewer = document.getElementById("viewer");

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(viewer.clientWidth, viewer.clientHeight);
        viewer.appendChild(this.renderer.domElement);

        this.camera.position.z = 50;

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        const gridHelper = new THREE.GridHelper(10000, 100, 0x444444, 0x323131);
        this.scene.add(gridHelper);
        const axesHelper = new THREE.AxesHelper(10000);
        this.scene.add(axesHelper);
    },

    onResize: function () {
        const viewer = document.getElementById("viewer");
        this.camera.aspect = viewer.clientWidth / viewer.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(viewer.clientWidth, viewer.clientHeight);
    },

    animate: function () {
        requestAnimationFrame(() => this.animate());
        this.updateTimer();
        this.updateAnimationSpheres();
        if (this.controls) this.controls.update();
        this.updateCameraWASD()
        this.renderer.render(this.scene, this.camera);
    },

    setupFileInput: function () {
        const dropZone = document.getElementById("dropZone");
        const fileInput = document.getElementById("fileInput");

        ["dragenter", "dragover"].forEach(eventName => {
            dropZone.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add("dragover");
            });
        });

        ["dragleave", "drop"].forEach(eventName => {
            dropZone.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove("dragover");
            });
        });

        dropZone.addEventListener("drop", e => {
            const file = e.dataTransfer.files[0];
            if (file) this.handleFile(file);
        });

        dropZone.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", e => {
            const file = e.target.files[0];
            if (file) this.handleFile(file);
        });
    },

    handleFile: function (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            const newPoints = this.parseFile(data);

            const levelId = newPoints.meta.levelId;
            const time = newPoints.meta.time;
            const frameCount = newPoints.meta.frameCount;
            const ghost = this.addGhost(newPoints, levelId, time, frameCount);

            this.updatePointClouds();
            this.addGhostUI(ghost);
        };
        reader.readAsText(file);
    },

    parseFile: function (fileData) {
        const points = [];
        const meta = {};

        const parts = fileData.split('$');
        if (parts.length < 2) {
            console.warn("Invalid file format — no $ separator found.");
            return points;
        }

        const metaPart = parts[0];
        const metaFields = metaPart.split('/');
        meta.levelId = metaFields[2] || "Unknown";
        meta.time = parseFloat(metaFields[3]) || 0.0;

        const dataPart = parts[1];
        const frameStrings = dataPart.split('|');
        meta.frameCount = frameStrings.length;

        let lastFramePoint = null;

        for (let i = 0; i < frameStrings.length; i++) {
            const frame = frameStrings[i];
            const pos = this.parseLine(frame, lastFramePoint, i === 0);
            if (pos) {
                points.push(pos);
                lastFramePoint = pos;
            }
        }

        points.meta = meta;
        return points;
    },

    parseLine: function (line, lastFramePoint, isFirstFrame) {
        const bIndex = line.indexOf('b');
        if (bIndex === -1) return null;

        let timeDelta = line.substring(1, bIndex);
        timeDelta = parseInt(timeDelta, 10);
        timeDelta = timeDelta / 10000;

        let posString = line.substring(bIndex + 1);

        const nextAlpha = posString.search(/[a-zA-Z]/);
        if (nextAlpha !== -1) {
            posString = posString.substring(0, nextAlpha);
        }

        const coords = posString.split(',');

        values = coords.map(str => {
            if (!str || str.trim() === "") {
                return 0.0;
            }
            if (str.includes(".")) {
                return parseFloat(str);
            } else {
                if (str.startsWith("-")) {
                    return parseFloat("-0." + str.slice(1));
                } else {
                    return parseFloat("0." + str);
                }
            }
        });

        const x = values[0];
        const y = values[1];
        const z = values[2];

        if (isFirstFrame) {
            return new FramePoint(new THREE.Vector3(0.0, y, 0.0), 0.0);
        } else {
            return new FramePoint(new THREE.Vector3(
                lastFramePoint.position.x - x,
                lastFramePoint.position.y + y,
                lastFramePoint.position.z + z
            ), lastFramePoint.time + timeDelta);
        }
    },

    addGhost: function (framePoints, levelId, time, frameCount) {
        const ghost = new Ghost(framePoints, levelId, time, frameCount);
        this.ghosts.push(ghost);
        this.updateDuration();
        return ghost;
    },

    removeGhost: function (ghost) {
        if (ghost.group) {
            ghost.group.traverse(obj => {
                if (obj.isMesh || obj.isLine || obj.isPoints) {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) {
                            obj.material.forEach(m => m.dispose());
                        } else {
                            obj.material.dispose();
                        }
                    }
                }
            });

            this.scene.remove(ghost.group);
            ghost.group = null;
        }

        if (ghost.animationSphere) {
            if (ghost.animationSphere.geometry) ghost.animationSphere.geometry.dispose();
            if (ghost.animationSphere.material) ghost.animationSphere.material.dispose();
            this.scene.remove(ghost.animationSphere);
            ghost.animationSphere = null;
        }
        this.ghosts = this.ghosts.filter(g => g !== ghost);
    },

    updatePointClouds: function () {
        if (this.ghosts) {
            this.ghosts.forEach(ghost => {
                if (!ghost.group) {
                    ghost.group = new THREE.Group();

                    const positions = ghost.framePoints.map(fp => fp.position);
                    const geometry = new THREE.BufferGeometry().setFromPoints(positions);
                    const material = new THREE.PointsMaterial({
                        size: 0.3,
                        color: ghost.color
                    });
                    const pointCloud = new THREE.Points(geometry, material);

                    const lineGeometry = new THREE.BufferGeometry().setFromPoints(positions);
                    const lineMaterial = new THREE.LineBasicMaterial({ color: ghost.color });
                    const line = new THREE.Line(lineGeometry, lineMaterial);

                    ghost.group.add(pointCloud);
                    ghost.group.add(line);

                    this.scene.add(ghost.group);
                } else {
                    ghost.group.traverse(obj => {
                        if (obj.isPoints || obj.isLine) {
                            obj.material.color.set(ghost.color);
                        }
                    });
                }
                ghost.group.scale.set(this.scale.x, this.scale.y, this.scale.z);
                ghost.group.position.set(this.offset.x, this.offset.y, this.offset.z);
            });
        }
    },

    updateAnimationSpheres: function () {
        this.ghosts.forEach(ghost => {
            if (!ghost.animationSphere) {
                const sphereGeom = new THREE.SphereGeometry(0.5, 32, 16);
                const sphereMat = new THREE.MeshBasicMaterial({ color: ghost.color });
                ghost.animationSphere = new THREE.Mesh(sphereGeom, sphereMat);

                this.scene.add(ghost.animationSphere);
            } else {
                ghost.animationSphere.material.color.set(ghost.color);
            }

            if (this.animation.time <= 0) {
                ghost.animationSphere.position.copy(
                    ghost.framePoints[0].position.clone()
                        .multiply(new THREE.Vector3(this.scale.x, this.scale.y, this.scale.z))
                        .add(new THREE.Vector3(this.offset.x, this.offset.y, this.offset.z))
                );
                return;
            }

            if (this.animation.time >= ghost.framePoints[ghost.frameCount - 1].time) {
                ghost.animationSphere.position.copy(
                    ghost.framePoints[ghost.frameCount - 1].position.clone()
                        .multiply(new THREE.Vector3(this.scale.x, this.scale.y, this.scale.z))
                        .add(new THREE.Vector3(this.offset.x, this.offset.y, this.offset.z))
                );
                return;
            }

            let low = 1;
            let high = ghost.framePoints.length - 1;

            while (low < high) {
                let mid = Math.floor((low + high) / 2);
                let midTime = ghost.framePoints[mid].time;

                if (midTime < this.animation.time) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }

            let startPoint = ghost.framePoints[low - 1].position.clone()
                .multiply(new THREE.Vector3(this.scale.x, this.scale.y, this.scale.z))
                .add(new THREE.Vector3(this.offset.x, this.offset.y, this.offset.z))

            let endPoint = ghost.framePoints[low].position.clone()
                .multiply(new THREE.Vector3(this.scale.x, this.scale.y, this.scale.z))
                .add(new THREE.Vector3(this.offset.x, this.offset.y, this.offset.z))

            let ratio = (ghost.framePoints[low].time == ghost.framePoints[low - 1].time) ? 0 : (this.animation.time - ghost.framePoints[low - 1].time) / (ghost.framePoints[low].time - ghost.framePoints[low - 1].time);
            let interpolatedPos = startPoint.lerp(endPoint, ratio);

            ghost.animationSphere.position.copy(interpolatedPos);
        });
    }
};

App.init();