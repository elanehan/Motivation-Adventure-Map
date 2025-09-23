const ThreeMap = {
    scene: null,
    camera: null,
    renderer: null,
    regionZones: {}, // This will hold the 4 island groups
    regionMeshes: {}, // Will store the MAIN mesh that glows
    baseMaterials: {}, // To store original colors
    controls: null,
    raycaster: null,
    pointer: null,
    clickableMeshes: [], // We'll store our models here
    labels: {},
    SEED : 352, // Fixed seed for consistent randomness

    init: function() {
        const container = document.getElementById('three-map-canvas');
        if (!container) return;

        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a); // Very dark blue/black

        // 2. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        // 3. Camera (Isometric)
        const aspect = container.clientWidth / container.clientHeight;
        const d = 20; // This controls the "zoom"
        this.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        this.camera.position.set(15, 20, 25); // Better starting view
        this.camera.lookAt(this.scene.position);

        // 4. Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5); 
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x8080ff, 0.1); // Dim blue light
        dirLight.position.set(-10, 20, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // 5. Define Base Materials
        this.baseMaterials.forest = new THREE.MeshPhongMaterial({ color: 0x3d8c40 });
        this.baseMaterials.mountains = new THREE.MeshPhongMaterial({ color: 0x808080 });
        this.baseMaterials.ocean = new THREE.MeshPhongMaterial({ color: 0xFF6F61 });
        this.baseMaterials.kingdom = new THREE.MeshPhongMaterial({ color: 0xfad02c });

        // 6. Handle Resizing
        window.addEventListener('resize', () => this.onResize());
        this.onResize(); // Call once to set initial size

        // 8. Orbit Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true; // Smooths out the movement
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Don't let user go "under" the map

        // 9. Raycaster & Mouse Events
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        // Use .bind(this) to make sure 'this' refers to ThreeMap inside the functions
        window.addEventListener('pointermove', this.onPointerMove.bind(this));
        window.addEventListener('click', this.onPointerClick.bind(this));

        // 10. Find Labels
        this.labels.forest = document.getElementById('label-forest');
        this.labels.mountains = document.getElementById('label-mountains');
        this.labels.ocean = document.getElementById('label-ocean');
        this.labels.kingdom = document.getElementById('label-kingdom');
        // 11. Start Animation Loop
        this.animate();
    },
    onPointerMove: function(event) {
        // Calculate pointer position in normalized device coordinates (-1 to +1)
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    },

    onPointerClick: function(event) {
        // Update the picking ray with the camera and pointer position
        this.raycaster.setFromCamera(this.pointer, this.camera);

        // Calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObjects(this.clickableMeshes);

        if (intersects.length > 0) {
            // An object was clicked!
            const clickedObject = intersects[0].object;
            console.log("You clicked on:", clickedObject.name);
            
            // You could open a modal or do something else here
            // Example: alert("You clicked on the " + clickedObject.name + " region!");
        }
    },

    buildWorldFromQuests: function(allTasks, playerLevel) {
        // 1. Clear old quest objects from the scene
        this.clickableMeshes = [];
        Object.values(this.regionZones).forEach(zone => {
            if (zone) { // Check if zone exists
                while (zone.children.length > 0) { // Remove all old models
                    zone.remove(zone.children[0]);
                }
            }
        });
        // This removes old zones from the scene
        this.scene.children.filter(child => child.userData.isZone).forEach(child => {
            this.scene.remove(child);
        });

        // 2. Define Island size based on level
        const baseSize = 25;
        const islandSize = baseSize + (playerLevel * 2); // Land grows by 2 units per level
        const placementArea = (islandSize / 2) * 0.8; // Objects will be placed in 80% of the island
        const islandGeo = new THREE.PlaneGeometry(islandSize, islandSize);

        const offset = islandSize / 2; 
        
        // Forest Zone
        const forestIsland = new THREE.Mesh(islandGeo, new THREE.MeshPhongMaterial({ color: 0x2a592c }));
        forestIsland.rotation.x = -Math.PI / 2;
        forestIsland.receiveShadow = true;
        this.regionZones.forest = new THREE.Group();
        this.regionZones.forest.add(forestIsland);
        this.regionZones.forest.position.set(-offset, 0, offset); // <-- Use -offset, +offset
        this.regionZones.forest.userData.isZone = true;
        this.scene.add(this.regionZones.forest);

        // Mountains Zone
        const mountainIsland = new THREE.Mesh(islandGeo, new THREE.MeshPhongMaterial({ color: 0x504b46 }));
        mountainIsland.rotation.x = -Math.PI / 2;
        mountainIsland.receiveShadow = true;
        this.regionZones.mountains = new THREE.Group();
        this.regionZones.mountains.add(mountainIsland);
        this.regionZones.mountains.position.set(-offset, 0, -offset); // <-- Use -offset, -offset
        this.regionZones.mountains.userData.isZone = true;
        this.scene.add(this.regionZones.mountains);

        // Ocean Zone 
        const oceanIsland = new THREE.Mesh(islandGeo, new THREE.MeshPhongMaterial({ color: 0x2b4f8f }));
        oceanIsland.rotation.x = -Math.PI / 2;
        oceanIsland.receiveShadow = true;
        this.regionZones.ocean = new THREE.Group();
        this.regionZones.ocean.add(oceanIsland);
        this.regionZones.ocean.position.set(offset, 0, offset); // <-- Use +offset, +offset
        this.regionZones.ocean.userData.isZone = true;
        this.scene.add(this.regionZones.ocean);
        
        // Kingdom Zone
        const kingdomIsland = new THREE.Mesh(islandGeo, new THREE.MeshPhongMaterial({ color: 0x756c39 }));
        kingdomIsland.rotation.x = -Math.PI / 2;
        kingdomIsland.receiveShadow = true;
        this.regionZones.kingdom = new THREE.Group();
        this.regionZones.kingdom.add(kingdomIsland);
        this.regionZones.kingdom.position.set(offset, 0, -offset); // <-- Use +offset, -offset
        this.regionZones.kingdom.userData.isZone = true;
        this.scene.add(this.regionZones.kingdom);
        
        // 3. Loop through all tasks and place an object for each
        allTasks.forEach(task => {
            let model;
            const region = task.region.toLowerCase();
            let targetZone;

            let seed = this.SEED;
            for (let i = 0; i < task.id.length; i++) {
                seed += task.id.charCodeAt(i);
            }

            switch (region) {
                case 'forest':
                    model = this.createTreeModel(task, seed);
                    targetZone = this.regionZones.forest;
                    break;
                case 'mountains':
                    model = this.createMountainModel(task, seed);
                    targetZone = this.regionZones.mountains;
                    break;
                case 'ocean': // Our new region
                    model = this.createCoralReefModel(task, seed);
                    targetZone = this.regionZones.ocean;
                    break;
                case 'kingdom':
                    model = this.createHouseModel(task, seed);
                    targetZone = this.regionZones.kingdom;
                    break;
                default:
                    return; // Skip this task if region is unknown
            }

            if (model && targetZone) {
                // Link quest to model
                model.userData.questId = task.id;
                model.userData.region = region;
                model.userData.isBoss = task.isBoss; // Store boss status
                if (task.isBoss) {
                    model.scale.set(2.0, 2.0, 2.0);
                }

                // Set position randomly on the 25x25 island
                const x = ( (seed % 100) / 100 - 0.5 ) * (placementArea * 2); 
                const z = ( (seed % 80) / 80 - 0.5 ) * (placementArea * 2); 
                model.position.set(x, 0, z); // Y is 0
                
                // Set its color based on status
                this.setObjectStatus(model, task.status);

                // Add to clickable list and its zone
                model.userData.mainMesh.name = region; // For the click handler
                this.clickableMeshes.push(model.userData.mainMesh);
                targetZone.add(model);
            }
        });
    },

    updateQuestStatus: function(questId, newStatus) {
        // Find the matching object in the whole 3D scene
        // We search recursively (true) to find it inside the groups
        const modelGroup = this.scene.getObjectByProperty('questId', questId, true); 
        
        if (modelGroup) {
            this.setObjectStatus(modelGroup, newStatus);
        }
    },

    animate: function() {
        this.controls.update();
        // We must use .bind(this) to keep the 'this' context correct
        requestAnimationFrame(this.animate.bind(this));
        this.updateLabelPositions(); 
        this.renderer.render(this.scene, this.camera);
    },

    onResize: function() {
        const container = document.getElementById('three-map-canvas');
        if (!container || !this.renderer) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        // Update PerspectiveCamera
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        // Update renderer
        this.renderer.setSize(width, height);
    },
    updateLabelPositions: function() {
        if (!this.renderer || !this.camera) return;
        const canvas = this.renderer.domElement;

        // Helper function to update one label
        const updateLabel = (label, zone) => {
            if (!label || !zone) return;

            const vector = zone.position.clone();
            // project the 3D position of the island to 2D screen space
            vector.project(this.camera);
            
            // If z > 1, the object is behind the camera
            if (vector.z > 1) {
                label.style.display = 'none';
                return;
            }
            
            label.style.display = 'block';
            
            // Convert from NDC (-1 to +1) to screen pixels (0 to width/height)
            const x = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
            const y = (-vector.y * 0.5 + 0.5) * canvas.clientHeight;
            
            // Apply the position using transform
            label.style.transform = `translate(${x}px, ${y}px)`;
        };

        // Update all four labels
        updateLabel(this.labels.forest, this.regionZones.forest);
        updateLabel(this.labels.mountains, this.regionZones.mountains);
        updateLabel(this.labels.ocean, this.regionZones.ocean);
        updateLabel(this.labels.kingdom, this.regionZones.kingdom);
    },
    createTreeModel: function(task, seed) { 
        const tree = new THREE.Group();
        const trunkHeight = 1.0; 
        // Use the seed to pick a radius
        const leavesRadius = ( (seed % 5) / 10 ) + 0.6; // (0.0 to 0.4) + 0.6 = 0.6 to 1.0
        // Use the seed to pick a rotation
        const yRotation = (seed % 100) / 100 * (Math.PI * 2); 
        // Use the seed to pick a color
        const leafColors = [
            0x3d8c40, // Standard Green
            0xffb6c1, // Light Pink
            0xFF847C, // Coral
            0xbb3e03, // Dark Orange
            0xedf6f9  // Very Light Blue
        ];
        const randomLeafColor = leafColors[seed % leafColors.length]; // Use modulo

        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.2, trunkHeight, 6);
        const trunkMat = new THREE.MeshPhongMaterial({ color: 0x4d3326 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = trunkHeight / 2; 
        trunk.castShadow = true;
        
        const leavesMat = new THREE.MeshPhongMaterial({ color: randomLeafColor });
        const leavesGeo = new THREE.IcosahedronGeometry(leavesRadius);
        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = trunkHeight; 
        leaves.castShadow = true;
        
        tree.add(trunk);
        tree.add(leaves);
        
        tree.rotation.y = yRotation; // Use our seeded rotation
        
        tree.userData.mainMesh = leaves; 
        tree.userData.baseColor = randomLeafColor;
        return tree;
    },
    createMountainModel: function(task, seed) { 
        const mountainGroup = new THREE.Group();
        const height = 1.5;
        const radius = ( (seed % 5) / 10 ) + 0.75; // (0.0 to 0.4) + 0.75
        const radialSegments = (seed % 3) + 5; // 5, 6, or 7 sides
        const yRotation = (seed % 100) / 100 * (Math.PI * 2);
        
        const mountainColors = [
            0x495057, // Rock Mountain (Grey)
            0xfffafa, // Snow Mountain (White)
            0x132a13, // Green Mountain (Mossy)
            0x441d0e, // Grand Canyon (Orange/Brown)
            0xbf3100  // Red Leaves Mountain (Firebrick)
        ];
        const randomMtnColor = mountainColors[seed % mountainColors.length];
        
        const mountainGeo = new THREE.ConeGeometry(radius, height, radialSegments);
        const mountainMat = new THREE.MeshPhongMaterial({ color: randomMtnColor });
        
        const mountain = new THREE.Mesh(mountainGeo, mountainMat);
        mountain.castShadow = true;
        mountain.position.y = height / 2; 
        mountain.rotation.y = yRotation; 
        
        mountainGroup.add(mountain);
        
        mountainGroup.userData.mainMesh = mountain; 
        mountainGroup.userData.baseColor = randomMtnColor;
        return mountainGroup;
    },
    createCoralReefModel: function(task, seed) { 
        const reef = new THREE.Group();
        const coralColors = [
            0xFF6F61, // Living Coral (Red-Pink)
            0x40E0D0, // Turquoise (Blue-Green)
            0xDA70D6, // Orchid (Purple-Pink)
            0xFFA500  // Orange
        ];
        const randomColor = coralColors[seed % coralColors.length];
        const mat = new THREE.MeshPhongMaterial({ color: randomColor });
        
        // Store the random color for the "light up" function
        reef.userData.baseColor = randomColor; 

        // --- 4. Use the seed for branches ---
        const numBranches = (seed % 4) + 3; // 3 to 6 branches
        let mainBranch = null; 

        for (let i = 0; i < numBranches; i++) {
            // Use the seed + loop index to make each branch different
            const branchSeed = seed + (i * 10); 
            const height = ( (branchSeed % 8) / 10 ) + 0.4; // 0.4 to 1.1
            const radius = 0.1;
            
            const branchGeo = new THREE.CylinderGeometry(radius, radius, height, 5);
            branchGeo.translate(0, height / 2, 0); 
            
            const branch = new THREE.Mesh(branchGeo, mat);
            
            // Use seed for random rotation
            branch.rotation.x = ( (branchSeed % 100) / 100 - 0.5 ) * Math.PI; 
            branch.rotation.z = ( (branchSeed % 50) / 50 - 0.5 ) * Math.PI; 
            branch.rotation.y = ( (branchSeed % 75) / 75 ) * Math.PI; 
            
            branch.castShadow = true;
            reef.add(branch);
            
            if (i === 0) {
                mainBranch = branch; 
            }
        }

        reef.userData.mainMesh = mainBranch; 
        return reef;
    },
    createHouseModel: function(task, seed) { 
        const house = new THREE.Group();
        // Base of the house (always yellow)
        const baseMat = this.baseMaterials.kingdom.clone();
        const baseGeo = new THREE.BoxGeometry(1, 1, 1);
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.5; // Base at y=0
        base.castShadow = true;

        // --- 3. Use the seed for the roof color ---
        const roofColors = [
            0x660708, // Red
            0x034732, // Dark Green
            0x003f88, // Blue
            0xff758f, // Pink
            0x440381  // Purple
        ]; 
        const randomColor = roofColors[seed % roofColors.length];
        const roofMat = new THREE.MeshPhongMaterial({ color: randomColor });
        
        const roofGeo = new THREE.ConeGeometry(0.8, 0.5, 4); 
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 1.25; // Sits on top of the 1-unit high base
        roof.rotation.y = Math.PI / 4; 
        roof.castShadow = true;

        house.add(base);
        house.add(roof);
        
        house.userData.mainMesh = roof;
        return house;
    },
    setObjectStatus: function(model, status) {
        const region = model.userData.region;
        const isBoss = model.userData.isBoss || false;
        
        // Get the base color (random or default)
        const baseColorHex = model.userData.baseColor || this.baseMaterials[region].color.getHex();
        const baseColor = new THREE.Color(baseColorHex);

        if (status === 'done') {
            model.visible = true; 
            
            model.traverse(child => {
                if (child.isMesh) {
                    let partColor = baseColor;
                    let shouldGlow = true; 
                    
                    if (region === 'forest' && child.geometry.type === 'CylinderGeometry') {
                        partColor = new THREE.Color(0x4d3326); // Keep trunk brown
                        shouldGlow = false; 
                    } else if (region === 'kingdom' && child.geometry.type === 'ConeGeometry') {
                        partColor = child.material.color; // Keep random roof color
                        shouldGlow = true; // The roof NOW glows
                    } else if (region === 'kingdom' && child.geometry.type === 'BoxGeometry') {
                        partColor = baseColor; // Base is yellow
                        shouldGlow = false; // The base NO LONGER glows
                    }
                    
                    child.material.color.set(partColor); 
                    
                    if (shouldGlow) {
                        // --- FIX 1 ---
                        // The roof should glow its *own* color, not the base yellow
                        child.material.emissive.set(partColor); 
                        child.material.emissiveIntensity = isBoss ? 2.5 : 0.8;
                    } else {
                        child.material.emissive.set(0x000000); 
                        child.material.emissiveIntensity = 0;
                    }
                }
            });

            const glowMesh = model.userData.mainMesh;
            const lightColor = glowMesh ? glowMesh.material.color : baseColor;
            const lightIntensity = isBoss ? 3.0 : 1.0; 
            const lightDistance = isBoss ? 15 : 8; // Boss light reaches further
            const pointLight = new THREE.PointLight(lightColor, lightIntensity, lightDistance);
            pointLight.position.y = 1.5; 
            pointLight.name = "questLight"; 
            model.add(pointLight); 
                
        } else if (status === 'inprogress') {
            model.visible = true; 
            
            // This 'traverse' loop correctly darkens all parts
            model.traverse(child => {
                if (child.isMesh) {
                    // Don't darken the trunk or the random roof
                    if (child.material.color.getHex() === 0x4d3326) return; // trunk
                    if (region === 'kingdom' && child.geometry.type === 'ConeGeometry') return; // roof

                    child.material.color.set(0x555555); // Dark grey
                    child.material.emissive.set(0x000000);
                    child.material.emissiveIntensity = 0;
                }
            });
        
        } else { // 'todo'
            model.visible = false; 
        }
    }
};
