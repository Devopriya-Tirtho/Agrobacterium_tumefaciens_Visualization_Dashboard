//Packages 
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js'; 
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/controls/OrbitControls.js'; 
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/GLTFLoader.js'; 
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/RGBELoader.js'; 
import { RoughnessMipmapper } from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/utils/RoughnessMipmapper.js';

//For Optimization purpose- load datasets and make cache
let nodeData3D = null;
let nodeData2D = null;
let edgeData = null;
let heatmapData = null;
let geneDensityData = null; //not having gene density data for Bacillus

// Step 1: Initialize IndexedDB
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('myDatabase', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('datasets')) {
                db.createObjectStore('datasets');
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Step 2: Store Data in IndexedDB
function storeInDatabase(key, data) {
    return openDatabase().then((db) => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['datasets'], 'readwrite');
            const objectStore = transaction.objectStore('datasets');
            const request = objectStore.put(data, key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    });
}

// Step 3: Retrieve Data from IndexedDB
function retrieveFromDatabase(key) {
    return openDatabase().then((db) => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['datasets'], 'readonly');
            const objectStore = transaction.objectStore('datasets');
            const request = objectStore.get(key);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    });
}

// Step 4: Update fetchAndCacheJson Function
async function fetchAndCacheJson(filePath, storageKey) {
    console.log(`Checking cache for ${storageKey}`);
    const cachedData = await retrieveFromDatabase(storageKey);
    if (cachedData) {
        console.log(`Using cached data for ${storageKey}`);
        return cachedData;
    }

    console.log(`Fetching data from server for ${filePath}`);
    const response = await fetch(filePath);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    await storeInDatabase(storageKey, data);
    return data;
}



// Fetch and cache datasets function
async function fetchAndCacheDatasets(selectedDataset) {
    try {
        console.log(`Fetching 3D node data for ${selectedDataset}`);
        nodeData3D = await fetchAndCacheJson(`${selectedDataset}_Node_3D.json`, 'nodeData3D');

        console.log(`Fetching 2D node data for ${selectedDataset}`);
        nodeData2D = await fetchAndCacheJson(`${selectedDataset}_Node_2D.json`, 'nodeData2D');

        console.log(`Fetching edge data for ${selectedDataset}`);
        edgeData = await fetchAndCacheJson(`${selectedDataset}_Edge_top10_interactions.json`, 'edgeData');

        console.log(`Fetching heatmap data for ${selectedDataset}`);
        heatmapData = await fetchAndCacheJson(`${selectedDataset}_Edge_processed_with_interaction.json`, 'heatmapData');

        console.log("All datasets loaded successfully");
    } catch (error) {
        console.error("Error loading datasets:", error);
    }
}


// Add a function to clear the local storage if needed

function clearLocalStorage() {
    localStorage.removeItem('nodeData3D');
    localStorage.removeItem('nodeData2D');
    localStorage.removeItem('edgeData');
    localStorage.removeItem('heatmapData');
    // localStorage.removeItem('geneDensityData');
    console.log("Local storage cleared");
}


// Function to clear IndexedDB
function clearIndexedDB() {
    return new Promise((resolve, reject) => {
        // Reopen the database to force any open connections to close
        const openRequest = indexedDB.open('myDatabase');

        openRequest.onupgradeneeded = (event) => {
            // This triggers a version change, causing other open connections to close
            console.log("Forcing connections to close by triggering onupgradeneeded.");
        };

        openRequest.onsuccess = (event) => {
            const db = event.target.result;

            // Close this connection immediately
            db.close();

            // Now proceed to delete the database
            const request = indexedDB.deleteDatabase('myDatabase');

            request.onsuccess = () => {
                console.log("IndexedDB cleared successfully");
                resolve();
            };

            request.onerror = (event) => {
                console.error("Error clearing IndexedDB:", event.target.error);
                reject(event.target.error);
            };

            request.onblocked = () => {
                console.warn("Clear IndexedDB operation blocked. Waiting for all connections to close.");
                // Optionally, retry logic can be added here if desired.
            };

            request.onupgradeneeded = (event) => {
                console.log("Upgrade needed for IndexedDB");
            };
        };

        openRequest.onerror = (event) => {
            console.error("Error opening database:", event.target.error);
            reject(event.target.error);
        };
    });
}




// Call this function when you need to clear the cache
// clearLocalStorage();




//For 3d vis nodehighlight interaction
var selectedNode = null;

//For range visualization
let selectedNodeIds = [];
let selectedNodeIdsForRange = [];

// Defining these globally
var scene, camera, renderer, controls;
// Define nodePositions globally
var nodePositions = {};
// This function sets up listeners to manage the dropdown behavior
function setupDropdownToggle() {
    const dropBtn = document.getElementById('node-select-btn');
    const dropdownContent = document.getElementById('node-dropdown');

    dropBtn.addEventListener('click', function(event) {
        dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
        event.stopPropagation(); // Prevent clicks from closing the dropdown
    });

    // Close the dropdown if clicking outside of it
    window.addEventListener('click', function() {
        if (dropdownContent.style.display === 'block') {
            dropdownContent.style.display = 'none';
        }
    });

    // Stop propagation of click events inside the dropdown
    dropdownContent.addEventListener('click', function(event) {
        event.stopPropagation();
    });
}

//Function for dynamic Event Listeners
function addDynamicEventListeners() {
    // Handle "Select All" functionality
    document.getElementById('select-all-nodes').addEventListener('change', function() {
        const allCheckboxes = document.querySelectorAll('#node-checkboxes input[type="checkbox"]:not(#select-all-nodes)');
        allCheckboxes.forEach(checkbox => checkbox.checked = this.checked);
    });

    // Clear button functionality
    document.getElementById('clear-nodes-button').addEventListener('click', function() {
        const allCheckboxes = document.querySelectorAll('#node-checkboxes input[type="checkbox"]');
        allCheckboxes.forEach(checkbox => checkbox.checked = false);
    });

    // Visualize button functionality
    document.getElementById('visualize-nodes').addEventListener('click', function() {
        selectedNodeIdsForRange = []; // Reset the range selection

        // Reset sliders to 100%
        document.getElementById('edgeWeightSlider').value = 100;
        document.getElementById('edgeWeightValue').innerText = '100%';
        document.getElementById('linkOpacitySlider').value = 100;
        document.getElementById('linkOpacityValue').innerText = '100%';

        const selectedNodeIds = Array.from(document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked'))
                                    .map(checkbox => checkbox.dataset.nodeId);
        const selectedDataset = document.getElementById('dataset-selector').value.replace(/ /g, '_');

        // Get interaction filters
        const interactionFilters = Array.from(document.querySelectorAll('input[name="interaction"]:checked'))
                                        .map(checkbox => parseInt(checkbox.value));

        const edgeDataPath = `${selectedDataset}_Edge_top10_interactions.json`;
        
        fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, interactionFilters, function(filteredEdges) {
            clearEdges3D();
            createEdges3D(filteredEdges);  // Draw 3D edges
            // Highlight nodes in 3D
            highlightNodes3D(selectedNodeIds);

            const context = document.getElementById('canvas2D').getContext('2d');
            drawEdges2D(filteredEdges, context);

            // Heatmap Visualization
            selectedNodes.clear();  // Clear the set and add all currently selected nodes
            selectedNodeIds.forEach(id => selectedNodes.add(id));

            const svg = d3.select('#visualization3').select('svg');
            updateHeatmapHighlights(svg, false);  // Pass false to indicate node highlighting

            // For Parallel Plot
            setupAndDrawParallelPlot(edgeDataPath, selectedNodeIds);
        });
    });

    // Handle visualize-range option
document.getElementById('visualize-range').addEventListener('click', function() {
    const fromBin = parseInt(document.getElementById('fromBin').value);
    const toBin = parseInt(document.getElementById('toBin').value);

    if (isNaN(fromBin) || isNaN(toBin) || fromBin > toBin) {
        alert("Please enter a valid range of bin numbers.");
        return;
    }

    // Reset sliders to 100%
    document.getElementById('edgeWeightSlider').value = 100;
    document.getElementById('edgeWeightValue').innerText = '100%';
    document.getElementById('linkOpacitySlider').value = 100;
    document.getElementById('linkOpacityValue').innerText = '100%';

    // Update the selected node IDs for the range
    selectedNodeIdsForRange = [];
    for (let i = fromBin; i <= toBin; i++) {
        selectedNodeIdsForRange.push(i.toString());
    }

    // Update the heatmap highlights based on the range
    selectedNodes.clear();  // Clear the set and add all currently selected nodes
    selectedNodeIdsForRange.forEach(id => selectedNodes.add(id));

    const svg = d3.select('#visualization3').select('svg');
    updateHeatmapHighlights(svg, true);  // Pass true to indicate range highlighting

    const selectedDataset = document.getElementById('dataset-selector').value.replace(/ /g, '_');
    const edgeDataPath = `${selectedDataset}_Edge_top10_interactions.json`;
    const nodeDataPath = `${selectedDataset}_Node_2D.json`;

    // Get the interaction filters based on user selection
    const interactionFilters = Array.from(document.querySelectorAll('input[name="interaction"]:checked'))
                                .map(checkbox => parseInt(checkbox.value));

    // Fetch and filter edge data based on selected nodes and interaction filters
    fetchAndFilterEdgeData(edgeDataPath, selectedNodeIdsForRange, interactionFilters, function(filteredEdges) {
        // Clear and update the 3D edges
        clearEdges3D();
        createEdges3D(filteredEdges);

        // Highlight the nodes in 3D
        highlightNodes3D(selectedNodeIdsForRange);

        // Clear and update the 2D edges
        const canvas = document.getElementById('canvas2D');
        const context = canvas.getContext('2d');
        fetch(nodeDataPath).then(response => response.json()).then(nodeData => {
            clearOnlyEdges2D(context, canvas, nodeData);
            drawEdges2D(filteredEdges, context);
        });

        // Update the parallel plot with filtered edges and interaction filters
        updateParallelPlot(edgeDataPath, selectedNodeIdsForRange, filteredEdges.length, filteredEdges, interactionFilters);
    });
});


    // Button for implementation of inter/intra interaction filtering for visualized edges
    document.getElementById('apply-interaction').addEventListener('click', function() {
        const interactionFilters = Array.from(document.querySelectorAll('input[name="interaction"]:checked'))
                                    .map(checkbox => parseInt(checkbox.value));
    
        if (interactionFilters.length === 0) {
            alert("Please select at least one interaction type.");
            return;
        }
    
        const selectedDataset = document.getElementById('dataset-selector').value.replace(/ /g, '_');
        const edgeDataPath = `${selectedDataset}_Edge_top10_interactions.json`;
        const selectedNodeIds = selectedNodeIdsForRange.length > 0 ? selectedNodeIdsForRange : Array.from(document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked')).map(checkbox => checkbox.dataset.nodeId);
        const nodeDataPath = `${selectedDataset}_Node_2D.json`;
    
        fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, interactionFilters, function(filteredEdges) {
            const edgeWeightSlider = document.getElementById('edgeWeightSlider');
            const value = edgeWeightSlider.value;
    
            // Calculate the number of edges to show based on the slider percentage
            const numberOfEdgesToShow = Math.ceil(filteredEdges.length * (value / 100));
            document.getElementById('edgeWeightValue').innerText = `${value}% (${numberOfEdgesToShow} edges)`;
            console.log(`Slider value: ${value}% - Showing top ${numberOfEdgesToShow} weighted edges.`);
    
            // Sort edges by weight in descending order and take the top N based on the slider
            filteredEdges.sort((a, b) => b.Weight - a.Weight);
            const edgesToShow = filteredEdges.slice(0, numberOfEdgesToShow);
            console.log(`Edges to show after filtering: ${edgesToShow.length}`);
    
            // Clear and update 3D edges
            clearEdges3D();
            createEdges3D(edgesToShow);
            // Highlight nodes in 3D
            highlightNodes3D(selectedNodeIds);
    
            // Clear and update 2D edges
            const canvas = document.getElementById('canvas2D');
            const context = canvas.getContext('2d');
            fetch(nodeDataPath).then(response => response.json()).then(nodeData => {
                clearOnlyEdges2D(context, canvas, nodeData);
                drawEdges2D(edgesToShow, context);
            });
    
            // Update the parallel plot with the filtered edges and interaction filters
            updateParallelPlot(edgeDataPath, selectedNodeIds, numberOfEdgesToShow, edgesToShow, interactionFilters);
        });
    });
}



/////////////////////////////      For responsive design      /////////////////////
window.addEventListener('resize', () => {
    // Adjust 3D visualization size
    renderer.setSize(visualizationContainer.clientWidth, visualizationContainer.clientHeight);
    camera.aspect = visualizationContainer.clientWidth / visualizationContainer.clientHeight;
    camera.updateProjectionMatrix();

    // Adjust 2D canvas size
    const canvas2D = document.getElementById('canvas2D');
    if (canvas2D) {
        canvas2D.width = canvas2D.parentElement.clientWidth;
        canvas2D.height = canvas2D.parentElement.clientHeight;
    }

    // Adjust heatmap size
    const heatmapSVG = d3.select('#visualization3 svg');
    if (!heatmapSVG.empty()) {
        const container = d3.select('#visualization3');
        const width = container.node().getBoundingClientRect().width;
        const height = container.node().getBoundingClientRect().height;
        heatmapSVG.attr('width', width).attr('height', height);
    }

    // Adjust parallel plot size
    const parallelPlotSVG = d3.select('#visualization4 svg');
    if (!parallelPlotSVG.empty()) {
        const container = d3.select('#visualization4');
        const width = container.node().getBoundingClientRect().width;
        const height = container.node().getBoundingClientRect().height;
        parallelPlotSVG.attr('width', width).attr('height', height);
    }
});
///////////////////////////////////////

////////////////////////////////////////////////////////////
///////////////////// Start of DOM Content /////////////////
////////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', async function() {
    let worker = new Worker('worker.js');

    const slider = document.getElementById('edgeWeightSlider');
    if (slider) {
        slider.addEventListener('input', () => {
            updateEdgeVisibility(slider.value);
        });
    }

    const datasetSelector = document.getElementById('dataset-selector');
    datasetSelector.addEventListener('change', async function() {
        const selectedDataset = datasetSelector.value.replace(' ', '_');
        console.log(`Dataset selected: ${selectedDataset}`);

        if (selectedDataset) {
            // Clear previous data and state
            resetVisualizations();

            // Update images based on selected dataset
            updateImagesForDataset(selectedDataset);

            // Show loading spinner and placeholders
            document.getElementById('loadingSpinner').style.display = 'block';
            document.getElementById('placeholder1').style.display = 'block';
            document.getElementById('placeholder2').style.display = 'block';
            
            const placeholder3 = document.getElementById('placeholder3');
            if (placeholder3) {
                placeholder3.style.display = 'block';
            }
            
            document.getElementById('placeholder4').style.display = 'block';

            try {
                console.log('Clearing previous visualizations and local storage');
                clearVisualizationScenes(); // Clears all scenes
                clearLocalStorage(); // Clear local storage

                // Clear IndexedDB
                console.log('Clearing IndexedDB');
                await clearIndexedDB(); // Clear IndexedDB

                console.log('Terminating and reinitializing worker');
                worker.terminate(); // Terminate the previous worker
                worker = new Worker('worker.js'); // Reinitialize the worker

                console.log('Fetching and caching datasets');
                await fetchAndCacheDatasets(selectedDataset); // Fetch and cache all datasets

                console.log('Datasets fetched, now updating visualizations');
                console.log(`Node data 3D: ${nodeData3D ? 'loaded' : 'not loaded'}`);
                console.log(`Node data 2D: ${nodeData2D ? 'loaded' : 'not loaded'}`);
                console.log(`Edge data: ${edgeData ? 'loaded' : 'not loaded'}`);
                console.log(`Heatmap data: ${heatmapData ? 'loaded' : 'not loaded'}`);

                if (nodeData3D && nodeData2D && edgeData && heatmapData) {
                    console.log('Updating node dropdown');
                    updateNodeDropdown(nodeData3D); // Update the dropdown with the new data

                    console.log('Creating nodes for 3D visualization');
                    createNodes(nodeData3D); // For 3D visualization

                    console.log('Drawing 2D visualization');
                    draw2DVisualization(nodeData2D); // For 2D visualization

                    console.log('Setting up web worker for heatmap data');
                    worker.addEventListener('message', function(e) {
                        if (e.data.error) {
                            console.error('Error from worker:', e.data.error);
                            return;
                        }
                        const processedData = e.data;
                        console.log('Heatmap data processed by worker');
                        createHeatmap(processedData); // Render heatmap with processed data
                    });
                    console.log('Sending heatmap data to worker');
                    worker.postMessage(heatmapData); // Send data to worker

                    console.log('Setting up parallel plot data');
                    setupParallelPlotData(edgeData); // Use cached parallel plot data
                } else {
                    throw new Error('One or more datasets failed to load');
                }
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                console.log('Hiding loading spinner and placeholders');
                // Hide loading spinner and placeholders
                document.getElementById('loadingSpinner').style.display = 'none';
                document.getElementById('placeholder1').style.display = 'none';
                document.getElementById('placeholder2').style.display = 'none';
                
                if (placeholder3) {
                    placeholder3.style.display = 'none';
                }
                
                document.getElementById('placeholder4').style.display = 'none';
            }
        } else {
            console.log('No dataset selected, clearing existing visualizations');
            // Clear existing visualizations and hide placeholders
            clearVisualizationScenes();
            document.getElementById('placeholder1').style.display = 'none';
            document.getElementById('placeholder2').style.display = 'none';
            document.getElementById('placeholder3').style.display = 'none';
            document.getElementById('placeholder4').style.display = 'none';
        }
    });

    console.log('Initializing event listeners');
    addDynamicEventListeners();  // Initialize all event listeners
    setupDropdownToggle();       // Setup dropdown toggle behavior if defined
    addOpacityControl();  // Initialize opacity control
});

// Function to update images based on the selected dataset
function updateImagesForDataset(selectedDataset) {
    let imagePaths = {};

    // Define image paths based on the selected dataset
    switch (selectedDataset) {
        case 'Bacillus_30C':
            imagePaths = {
                visualization1: '1_1.JPG',
                visualization2: '1_2.JPG',
                visualization3: '1_3.JPG',
                visualization4: '2_4.JPG',
            };
            break;
        case 'Bacillus_42C45M':
            imagePaths = {
                visualization1: '2_1.JPG',
                visualization2: '2_2.JPG',
                visualization3: '2_3.JPG',
                visualization4: '2_4.JPG',
            };
            break;
        case 'Bacillus_42c120M':
            imagePaths = {
                visualization1: '3_1.JPG',
                visualization2: '3_2.JPG',
                visualization3: '3_3.JPG',
                visualization4: '2_4.JPG',
            };
            break;
        default:
            imagePaths = {
                visualization1: '3_1.JPG',
                visualization2: '3_2.JPG',
                visualization3: '3_3.JPG',
                visualization4: '2_4.JPG',
            };
            break;
    }

    // Update the image sources for each visualization with a check to ensure the element exists
    const img1 = document.querySelector('#placeholder1 img');
    const img2 = document.querySelector('#placeholder2 img');
    const img3 = document.querySelector('#placeholder3 img');
    const img4 = document.querySelector('#placeholder4 img');

    if (img1) {
        img1.src = imagePaths.visualization1;
        console.log('Placeholder 1 updated to', imagePaths.visualization1);
    }
    if (img2) {
        img2.src = imagePaths.visualization2;
        console.log('Placeholder 2 updated to', imagePaths.visualization2);
    }
    if (img3) {
        img3.src = imagePaths.visualization3;
        console.log('Placeholder 3 updated to', imagePaths.visualization3);
    }
    if (img4) {
        img4.src = imagePaths.visualization4;
        console.log('Placeholder 4 updated to', imagePaths.visualization4);
    }
}


// Function to reset visualizations
function resetVisualizations() {
    // Clear all visualizations
    clearVisualizationScenes();

    // Reset other necessary states or data
    clearLocalStorage();
    clearIndexedDB();
}



////////////////////////////////////////////////////////////
///////////////////////   End of DOM Content  /////////////////////////////////////
////////////////////////////////////////////////////////////

function updateNodeDropdown(nodes) {
    const nodeCheckboxesContainer = document.getElementById('node-checkboxes');
    nodeCheckboxesContainer.innerHTML = ''; // Clear existing checkboxes

    nodes.forEach((node, index) => {
        const checkboxContainer = document.createElement('div');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `node${index}`;

        // Extract only the numeric part of the node ID
        const numericId = node.id.replace(/^\D+/g, ''); // Removes non-digit characters at the start
        checkbox.dataset.nodeId = numericId; // Store only the numeric ID in data attribute

        // Check if the numericId is within the specified interval
        if (numericId >= 1 && numericId <= 401 && (numericId - 1) % 10 === 0) {
            checkbox.checked = true;
        }

        const label = document.createElement('label');
        label.htmlFor = `node${index}`;
        label.textContent = node.id; // Display the original node ID as the label text

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        nodeCheckboxesContainer.appendChild(checkboxContainer);
    });
}









//////////////Out of DOM CONTENT LOADED/////////////////////
//Function for filtering edged////
function filterTopWeightedEdges(edges, selectedNodeIds) {
    let nodeEdgeMap = new Map();

    // Gather edges connected to the selected nodes
    edges.forEach(edge => {
        let sourceId = String(edge.Source);
        let targetId = String(edge.Target);
        if (selectedNodeIds.includes(sourceId) || selectedNodeIds.includes(targetId)) {
            if (!nodeEdgeMap.has(sourceId)) {
                nodeEdgeMap.set(sourceId, []);
            }
            if (!nodeEdgeMap.has(targetId)) {
                nodeEdgeMap.set(targetId, []);
            }
            nodeEdgeMap.get(sourceId).push(edge);
            nodeEdgeMap.get(targetId).push(edge);
        }
    });

    let topEdges = [];
    // Apply the top 5% filter uniformly
    nodeEdgeMap.forEach((edges, nodeId) => {
        edges.sort((a, b) => b.Weight - a.Weight); // Sort by weight
        let top5PercentCount = Math.max(1, Math.ceil(edges.length * 0.05)); // Ensure at least one edge is selected
        topEdges.push(...new Set(edges.slice(0, top5PercentCount))); // Select top edges, ensure uniqueness here
    });

    // Return unique edges
    return Array.from(new Set(topEdges));
}



///////////////////////////////////
//Function for Handling Filtered edges////

// Function for Handling Filtered Edges
function fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, interactionFilters, callback) {
    fetch(edgeDataPath)
        .then(response => response.json())
        .then(allEdges => {
            // Filter edges to include only those where the source node is in selectedNodeIds
            let filteredEdges = allEdges.filter(edge => selectedNodeIds.includes(String(edge.Source)));

            // Apply interaction filters if provided
            if (interactionFilters && interactionFilters.length > 0) {
                filteredEdges = filteredEdges.filter(edge => interactionFilters.includes(edge.Interaction));
            }

            callback(filteredEdges);
        })
        .catch(error => console.error("Error fetching and filtering edge data:", error));
}

// Slider Control for Edge Visibility in 3D and 2D Visualization
let maxEdgeWeight = 0;  // Global variable to store the maximum edge weight

function updateEdgeVisibility(value) {
    const selectedNodeIds = selectedNodeIdsForRange.length > 0 
        ? selectedNodeIdsForRange 
        : Array.from(document.querySelectorAll('#node-checkboxes input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.dataset.nodeId);

    const selectedDataset = document.getElementById('dataset-selector').value.replace(/ /g, '_');
    const edgeDataPath = `${selectedDataset}_Edge_top10_interactions.json`;
    const nodeDataPath = `${selectedDataset}_Node_2D.json`;

    const interactionFilters = Array.from(document.querySelectorAll('input[name="interaction"]:checked'))
                                .map(checkbox => parseInt(checkbox.value));

    // Fetch and filter edge data based on selected nodes and interaction filters
    fetchAndFilterEdgeData(edgeDataPath, selectedNodeIds, interactionFilters, function(filteredEdges) {
        // Sort edges by weight in descending order
        filteredEdges.sort((a, b) => b.Weight - a.Weight);

        // Calculate the number of edges to show based on the slider percentage
        const numberOfEdgesToShow = Math.ceil(filteredEdges.length * (value / 100));
        const edgesToShow = filteredEdges.slice(0, numberOfEdgesToShow);

        document.getElementById('edgeWeightValue').innerText = `${value}% (${edgesToShow.length} edges)`;
        console.log(`Slider value: ${value}% - Showing top ${numberOfEdgesToShow} weighted edges.`);

        // Log edges to be shown in 3D
        console.log("3D Visualization Edges:", edgesToShow);

        // Clear and create 3D edges
        clearEdges3D();
        createEdges3D(edgesToShow);

        // Fetch node data and draw 2D edges
        const canvas = document.getElementById('canvas2D');
        const context = canvas.getContext('2d');
        fetch(nodeDataPath).then(response => response.json()).then(nodeData => {
            clearOnlyEdges2D(context, canvas, nodeData);
            drawEdges2D(edgesToShow, context);
        });

        // Update the parallel plot with the filtered edges
        updateParallelPlot(edgeDataPath, selectedNodeIds, numberOfEdgesToShow, edgesToShow, interactionFilters);
    });
}

// Function for Updating the Parallel Plot
// Function for Updating the Parallel Plot
function updateParallelPlot(edgeDataPath, selectedNodeIds, numberOfEdgesToShow, edgesFrom3D = [], interactionFilters = []) {
    fetch(edgeDataPath)
        .then(response => response.json())
        .then(data => {
            console.log("Fetched data for Parallel Plot:", data);

            // Filter edges based on selected source nodes
            let filteredEdges = data.filter(d => selectedNodeIds.includes(d.Source.toString()));

            // Apply interaction filters if provided
            if (interactionFilters && interactionFilters.length > 0) {
                filteredEdges = filteredEdges.filter(edge => interactionFilters.includes(edge.Interaction));
            }

            const edgesToShow = getTopEdges(filteredEdges, numberOfEdgesToShow);

            console.log("Edges passed from 3D Visualization:", edgesFrom3D);
            console.log("Edges filtered for Parallel Plot:", edgesToShow);

            // Check for discrepancies between 3D and parallel plot edges
            const discrepancy = edgesFrom3D.filter(edge3D => !edgesToShow.some(edge => 
                edge.Source === edge3D.Source && 
                edge.Target === edge3D.Target && 
                edge.Weight === edge3D.Weight
            ));
            console.log("Discrepancy between 3D and Parallel Plot Edges:", discrepancy);

            // Log the first discrepancy if there is one
            if (discrepancy.length > 0) {
                console.log("First discrepancy details:", {
                    EdgeIn3D: discrepancy[0],
                    CorrespondingEdgeInParallelPlot: edgesToShow.find(edge => 
                        edge.Source === discrepancy[0].Source && 
                        edge.Target === discrepancy[0].Target)
                });
            }

            // If there are no edges to show, exit early
            if (edgesToShow.length === 0) {
                console.warn("No edges to display in Parallel Plot.");
                return;
            }

            // Set up the parallel plot visualization
            const allNodes = {
                sources: [...new Set(data.map(d => d.Source))],
                targets: [...new Set(data.map(d => d.Target))]
            };
            const { svg, sourceScale, targetScale, width, height } = setupSVGandAxes(allNodes);

            drawLinks({ svg, sourceScale, targetScale, data: edgesToShow, width });
        })
        .catch(error => console.error("Error updating parallel plot:", error));
}



// Function for getting top edges based on weight
function getTopEdges(edges, numberOfEdgesToShow) {
    edges.sort((a, b) => b.Weight - a.Weight);
    return edges.slice(0, numberOfEdgesToShow);
}




function clearEdges3D() {
    // Traverse and remove all lines (edges) from the scene
    const toRemove = [];
    scene.traverse((object) => {
        if (object instanceof THREE.Line) {
            toRemove.push(object);
        }
    });
    toRemove.forEach(object => scene.remove(object));
    edges3D = []; // Clear the edges3D array
}

// Function for drawing edges of selected nodes for 3D visualization
function createEdges3D(edgeData) {
    // Identify the maximum and minimum weights
    const maxWeight = Math.max(...edgeData.map(edge => edge.Weight));
    const minWeight = Math.min(...edgeData.map(edge => edge.Weight));

    // Avoid dividing by a very small number by ensuring there's a minimum range
    const weightRange = maxWeight === minWeight ? 1 : (maxWeight - minWeight);

    edgeData.forEach(edge => {
        const sourceNode = scene.getObjectByName(String(edge.Source));
        const targetNode = scene.getObjectByName(String(edge.Target));

        if (sourceNode && targetNode) {
            // Normalize the weight to a range from 0 to 1, with a small adjustment to avoid extremes
            const normalizedWeight = (edge.Weight - minWeight) / weightRange;

            // Calculate blue shades: light blue (e.g., #ADD8E6) to dark blue (e.g., #00008B)
            const startColor = new THREE.Color(0xADD8E6); // Light Blue
            const endColor = new THREE.Color(0x00008B);   // Dark Blue

            // Interpolate between light blue and dark blue based on the normalized weight
            const edgeColor = startColor.clone().lerp(endColor, normalizedWeight);

            const lineMaterial = new THREE.LineBasicMaterial({
                color: edgeColor,
                transparent: true,
                opacity: 1.0
            });

            const points = [sourceNode.position.clone(), targetNode.position.clone()];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);

            // Store the source, target, and weight in userData
            line.userData = { source: edge.Source, target: edge.Target, weight: edge.Weight };

            scene.add(line);
            edges3D.push(line);
            console.log(`Drawing edge between ${edge.Source} and ${edge.Target} with normalized weight: ${normalizedWeight}`);
        } else {
            console.log(`Failed to find nodes for edge between ${edge.Source} and ${edge.Target}`);
        }
    });

    renderer.render(scene, camera);
}




    
///////////////////////////////////

//For controlling opacity of edges//
let edges3D = [];
let edges2D = [];
//////////////////////////////////////

//Function for draw edges of selected nodes for 2d vis////


function drawEdges2D(edgeData, context) {
    // Determine the range of edge weights
    const maxWeight = d3.max(edgeData, d => d.Weight);
    const minWeight = d3.min(edgeData, d => d.Weight);

    // Create a color scale based on edge weights
    const colorScale = d3.scaleLinear()
        .domain([minWeight, maxWeight])
        .range(['#ADD8E6', '#00008B']);  // Light grey to black

    context.globalAlpha = 0.5;  // 50% opacity for a subtle appearance
    context.lineWidth = 2;  // Slightly thicker line for better visibility
    context.lineCap = 'round';  // Rounded ends for a smoother look
    context.lineJoin = 'round';  // Rounded corners at line joins

    edges2D = []; // Clear the edges2D array before drawing

    edgeData.forEach(edge => {
        const sourceNode = nodePositions[edge.Source];
        const targetNode = nodePositions[edge.Target];

        if (sourceNode && targetNode) {
            context.beginPath();
            context.strokeStyle = colorScale(edge.Weight);  // Set stroke color based on weight
            context.moveTo(sourceNode.x, sourceNode.y);
            context.lineTo(targetNode.x, targetNode.y);
            context.stroke();
            edges2D.push({ source: sourceNode, target: targetNode });  // Push edge into edges2D array
            console.log(`Edge drawn from ${edge.Source} to ${edge.Target} with weight ${edge.Weight}`);
        } else {
            console.log(`Nodes not found for edge from ${edge.Source} to ${edge.Target}`);
        }
    });

    // Resetting context properties after drawing
    context.globalAlpha = 1.0;
    context.lineWidth = 1; // Reset line width to default
    context.lineCap = 'butt'; // Reset line cap to default
    context.lineJoin = 'miter'; // Reset line join to default
}


function clearOnlyEdges2D(context, canvas, nodeData) {
    context.clearRect(0, 0, canvas.width, canvas.height); // Clears the entire canvas
    draw2DVisualization(nodeData); // Redraw only nodes to avoid edge deletion
    edges2D = []; // Clear the edges2D array
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////





///////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////
///For Parallel Plots///


//Function for handling parallel plot after node selection
function setupAndDrawParallelPlot(dataset, selectedNodeIds) {
    fetch(dataset)
        .then(response => response.json())
        .then(data => {
            // Construct allNodes from the full dataset, not just filteredData
            const allNodes = {
                sources: [...new Set(data.map(d => d.Source))].sort((a, b) => a - b),
                targets: [...new Set(data.map(d => d.Target))].sort((a, b) => a - b)
            };

            // Now filter data to only include edges that have sources or targets in selectedNodeIds
            const filteredData = data.filter(d => selectedNodeIds.includes(String(d.Source)));

            if (filteredData.length === 0) {
                console.log("No data to draw links for selected nodes.");
                return;
            }

            // Setup SVG and axes using allNodes to ensure all possible nodes are included
            const { svg, sourceScale, targetScale, width, height } = setupSVGandAxes(allNodes);

            console.log("Filtered data for links:", filteredData);

            // Draw links only for selected nodes using the filtered data
            drawLinks({ svg, sourceScale, targetScale, data: filteredData, width }); 
        })
        .catch(error => console.error("Error setting up parallel plot:", error));
}



// Function to setup and fetch data for the parallel plot

async function setupParallelPlotData() {
    // To cancel out the existing still picture so that the actual visualization comes up
    document.getElementById('placeholder4').style.display = 'none';
    try {
        console.log("Using cached parallel plot data...");
        const data = edgeData;  // Use the cached edge data
        console.log("Parallel plot data fetched successfully:", data);
        maxEdgeWeight = Math.max(...data.map(d => d.Weight));
        const allNodes = {
            sources: [...new Set(data.map(d => d.Source))],
            targets: [...new Set(data.map(d => d.Target))]
        };
        setupSVGandAxes(allNodes);
    } catch (error) {
        console.error("Error setting up parallel plot data:", error);
    }
}

///
let sourceScale, targetScale, svgWidth, svgHeight;
let currentLinkColor = 'color';

document.getElementById('colorLinks').addEventListener('click', () => {
    setLinkColor('color');
});
document.getElementById('grayLinks').addEventListener('click', () => {
    setLinkColor('gray');
});


////
function setupSVGandAxes(allNodes) {
    // Combine sources and targets into one set, then convert to sorted array
    const combinedNodes = [...new Set([...allNodes.sources, ...allNodes.targets])].sort((a, b) => a - b);

    const container = d3.select("#visualization4");
    const margin = { top: 30, right: 30, bottom: 50, left: 30 },
         totalWidth = container.node().getBoundingClientRect().width,
         totalHeight = container.node().getBoundingClientRect().height,
         width = totalWidth - margin.left - margin.right,
         height = totalHeight - margin.top - margin.bottom;

    // Remove any existing SVG first
    container.select("svg").remove();

    // Create a new SVG element
    const svg = container.append("svg")
        .attr("width", totalWidth)
        .attr("height", totalHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    sourceScale = d3.scalePoint()
        .domain(combinedNodes)
        .range([0, height]);

    targetScale = d3.scalePoint()
        .domain(combinedNodes)
        .range([0, height]);

    // Function to select every 10th element for label, using the combined node list
    const tickInterval = 10;
    const ticks = combinedNodes.filter((d, i) => i % tickInterval === 0);

    // Call the function to draw gene density lines first
    //drawGeneDensityLinesParallelPlot(svg, width, height, margin, combinedNodes, sourceScale, targetScale);

    // Move the left axis further left
    svg.append("g")
        .call(d3.axisLeft(sourceScale).tickValues(ticks))
        .attr("transform", `translate(${25},0)`);  // Adjusted translation for left axis
    
    // Move the right axis a bit left
    svg.append("g")
        .call(d3.axisRight(targetScale).tickValues(ticks))
        .attr("transform", `translate(${width - 25},0)`);  // Adjusted translation for right axis

    svgWidth = width;
    svgHeight = height;

    // Initial draw of links with an empty dataset
    drawLinks({
        svg: svg,
        sourceScale: sourceScale,
        targetScale: targetScale,
        data: [], // Pass an empty array to not draw any links initially
        width: svgWidth,
        height: svgHeight
    });

    return { svg, sourceScale, targetScale, width, height };
}



///
function setLinkColor(color) {
    currentLinkColor = color;
    const svg = d3.select('#visualization4 svg');

    svg.selectAll("path")
        .attr("stroke", d => color === 'gray' ? 'gray' : initialColorScale(d.Source));

    // Update legend and tooltip visibility
    const legend = svg.select(".legend");
    if (color === 'gray') {
        legend.style("display", "none");
        d3.select("#tooltip").style("display", "none");
    } else {
        legend.style("display", "block");
    }
}

function updateLegendAndTooltip(colorScale) {
    const svg = d3.select('#visualization4 svg');

    // Remove existing legend items
    svg.selectAll(".legend-item").remove();

    // Create a new legend for color representation of each source
    const legend = svg.select(".legend");

    const legendItems = legend.selectAll(".legend-item")
        .data(colorScale.domain())
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(${i * 80}, 0)`);

    legendItems.append("rect")
        .attr("x", 0)
        .attr("width", 12)
        .attr("height", 12)
        .style("fill", d => colorScale(d));

    legendItems.append("text")
        .attr("x", 16)
        .attr("y", 6)
        .attr("dy", "0.35em")
        .text(d => `Source: ${d}`)
        .style("font-size", "10px");

    // Tooltip for legend items
    legendItems.on("mouseover", function(event, d) {
        d3.select("#tooltip")
          .style("display", "block")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px")
          .html(`Source: ${d}<br>Color: ${colorScale(d)}`);
    })
    .on("mouseout", function() {
        d3.select("#tooltip").style("display", "none");
    });
}




///Function for drawing links//////
let initialColorScale;

function drawLinks({ svg, sourceScale, targetScale, data, width, height, useWeightColor = false }) {
    svg.selectAll("path").remove();

    initialColorScale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain([...new Set(data.map(d => d.Source))]);

    // Define a sequential color scale based on weight for gray links
    const weightColorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain(d3.extent(data, d => d.Weight));

    const links = svg.append("g")
       .selectAll("path")
       .data(data)
       .enter()
       .append("path")
       .attr("d", d => {
           const sourceY = sourceScale(d.Source);
           const targetY = targetScale(d.Target);
           return `M20,${sourceY} L${width - 20},${targetY}`;  // Adjusted to start and end within the margins
       })
       .attr("stroke", d => useWeightColor ? weightColorScale(d.Weight) : initialColorScale(d.Source))
       .attr("stroke-width", 2)
       .attr("opacity", 0.7)
       .attr("fill", "none");

    // Tooltip functionality
    links.on("mouseover", function(event, d) {
        d3.select("#tooltip")
          .style("display", "block")
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY + 10) + "px")
          .html(`Source: ${d.Source}<br>Target: ${d.Target}<br>Weight: ${d.Weight.toFixed(4)}`);
    })
    .on("mouseout", function() {
        d3.select("#tooltip").style("display", "none");
    });

    // Create a legend for color representation of each source
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(10,355)");  // Adjusted to place at the desired position

    if (!useWeightColor) {
        updateLegendAndTooltip(initialColorScale);
    }

    // Add the opacity control slider functionality
    addOpacityControl();
}


//Control Opacity Function for Parallel Plot, 3d and 2d vis
function addOpacityControl() {
    const slider = document.getElementById('linkOpacitySlider');
    const sliderValue = document.getElementById('linkOpacityValue');

    slider.addEventListener('input', function() {
        const opacity = slider.value / 100;
        sliderValue.textContent = `${slider.value}%`;

        // Update opacity for parallel plot
        d3.selectAll('path').attr('opacity', opacity);

        // Update opacity for 2D edges
        const canvas = document.getElementById('canvas2D');
        if (canvas) {
            const context = canvas.getContext('2d');
            //context.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
            edges2D.forEach(edge => {
                context.globalAlpha = opacity; // Set new opacity
                context.beginPath();
                context.moveTo(edge.source.x, edge.source.y);
                context.lineTo(edge.target.x, edge.target.y);
                context.stroke();
            });
            context.globalAlpha = 1.0; // Reset to default
        }

        // Update opacity for 3D edges
        edges3D.forEach(line => {
            line.material.opacity = opacity;
        });

        renderer.render(scene, camera); // Re-render the 3D scene
    });
}


///////////////////////////////////////////////////////
function clearVisualizationScenes() {
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
        console.log('Clearing visualization scenes');
    }
}
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////
////////////            2D Visualization Setup      /////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////
function getColorForChID(chID) {
    // Define a fixed set of colors for distinct ChID values
    const colorMap = {
        "1": "#FF0000",   // Red
        "2": "#00FF00",   // Green
        "3": "#800080",   // Purple
        "4": "#00008B"    // Dark Blue
    };

    // Return the color corresponding to the ChID, or a default color if not found
    return colorMap[chID] || "#FF0000"; // Default to red if ChID is not in the map
}




// Then in drawing code:
//context.fillStyle = getColorForChID(String(node.ChID));
//////////////////////////////////////////////////////////////////////////////////
////////////            2D Visualization Setup      /////////////////////////////
const vis2Container = document.getElementById('visualization2');
const canvas2D = document.createElement('canvas');
canvas2D.width = vis2Container.clientWidth;
canvas2D.height = 500; // Set a fixed height or make it responsive
canvas2D.id = 'canvas2D'; // Assign an ID to the canvas for easy reference
vis2Container.appendChild(canvas2D);


function draw2DVisualization(data) {
    const tooltip = document.getElementById('tooltip2D');

    const canvas = document.getElementById('canvas2D');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }

    const context = canvas.getContext('2d');

    // Adjust canvas size to fit within the parent container
    const container = document.getElementById('visualization2');
    const containerRect = container.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;

    // Modify scaleX and scaleY calculations to add a buffer for margins
    const nodeRadius = 5;
    const padding = 20; // Padding from the canvas edges

    // Calculate scaling factors based on maximum coordinate ranges including padding
    const scaleX = (canvas.width - 2 * padding) / (getRange(data, 'x'));
    const scaleY = (canvas.height - 2 * padding) / (getRange(data, 'y'));

    // Determine the overall scale factor to fit the nodes within the canvas
    const scaleFactor = 0.8; // Adjust this factor as needed to fit the nodes within the canvas

    context.clearRect(0, 0, canvas.width, canvas.height);
    nodePositions = {}; // Reset positions map each time nodes are drawn

    // Sort nodes by numeric ID
    const sortedData = data.slice().sort((a, b) => parseInt(a.id.replace(/[^\d]/g, '')) - parseInt(b.id.replace(/[^\d]/g, '')));
    const startNode = sortedData[0];
    const endNode = sortedData[sortedData.length - 1];

    data.forEach(node => {
        const numericId = node.id.replace(/[^\d]/g, '');
        // Adjust node positions to include padding and ensure they stay within the canvas
        const x = padding + (node.x - getMin(data, 'x')) * scaleX * scaleFactor;
        const y = padding + (node.y - getMin(data, 'y')) * scaleY * scaleFactor;

        nodePositions[numericId] = { x, y };

        context.beginPath();
        context.arc(x, y, nodeRadius, 0, Math.PI * 2, true);

        // Set color based on the ChID value
        const color = getColorForChID(String(node.ChID)); // Get color based on ChID
        context.fillStyle = color; // Set node color
        context.shadowBlur = 0.5;
        context.shadowColor = color; // Use the same color for the shadow
        context.fill();
        context.shadowBlur = 0; // Reset shadow blur for other elements
    });

    // Function to check if a point is inside a node's circle
    function isPointInNode(x, y, nodeX, nodeY, radius) {
        return Math.sqrt((x - nodeX) ** 2 + (y - nodeY) ** 2) < radius;
    }

    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        let foundNode = false;

        //context.clearRect(0, 0, canvas.width, canvas.height); // Clear and redraw for hover effects
        data.forEach(node => {
            const numericId = node.id.replace(/[^\d]/g, '');
            const x = nodePositions[numericId].x;
            const y = nodePositions[numericId].y;
            if (isPointInNode(mouseX, mouseY, x, y, nodeRadius)) { // Node radius is 5
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.clientX + 10}px`;
                tooltip.style.top = `${e.clientY + 10}px`;
                tooltip.innerHTML = `Bin: ${node.id}`;

                // Highlight the node
                context.fillStyle = 'yellow'; // Change color for highlight
                foundNode = true;
            } else {
                // Reset to original color based on ChID
                const color = getColorForChID(String(node.ChID));
                context.fillStyle = color; // Set original node color
            }
            context.beginPath();
            context.arc(x, y, nodeRadius, 0, Math.PI * 2, true); // Node radius is 5
            context.fill();
        });

        if (!foundNode) {
            tooltip.style.display = 'none';
        }
    });

    canvas.addEventListener('mouseout', function() {
        tooltip.style.display = 'none'; // Hide tooltip when not hovering over canvas
    });
}





// Helper functions to get the range and minimum value of nodes
function getRange(data, coord) {
    return Math.max(...data.map(node => node[coord])) - Math.min(...data.map(node => node[coord]));
}

function getMin(data, coord) {
    return Math.min(...data.map(node => node[coord]));
}

//////////////////////////////////////
async function fetchProcessedEdgeData(filePath) {
    try {
        console.log("Fetching processed edge data...");
        const rawData = await d3.json(filePath);
        console.log("Edge data fetched successfully:", rawData);
        const processedData = preprocessDataForHeatmap(rawData);
        createHeatmap(processedData);
    } catch (error) {
        console.error("Error fetching processed edge data:", error);
    }
}

function preprocessDataForHeatmap(rawData) {
    // Create a new array that will contain both halves of the matrix
    const processedData = [];
  
    // Iterate over each entry in the original data array
    rawData.forEach(entry => {
      // Add the original entry
      processedData.push({
        Source: (entry.Source),
        Target: (entry.Target),
        Weight: entry.Weight
      });
      // Add the mirrored entry if it's not the diagonal
      if (entry.Source !== entry.Target) {
        processedData.push({
          Source: (entry.Target), // Note the switch here
          Target: (entry.Source), // Source becomes Target and vice versa
          Weight: entry.Weight // The weight is the same
        });
      }
    });
    
    return processedData;
}

////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////
///////////////////////Heatmap Setting//////////////////////////////////////////////  
//For Zoom Functionality//
function createHeatmap(data) {
    const tooltip = d3.select("#tooltipHeatmap");
    const container = d3.select('#visualization3');
    const margin = { top: 0, right: 100, bottom: 100, left: 0 }; // Increased right margin for better legend positioning
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;
    const size = Math.min(containerWidth - margin.left - margin.right, containerHeight - margin.top - margin.bottom); // Make it square
    const width = size;
    const height = size;

    // Calculate the offset to center the heatmap and color map
    const offsetX = (containerWidth - width - margin.right) / 2;
    const offsetY = (containerHeight - height) / 2;

    // Clear any existing content in the container
    container.selectAll('*').remove();

    // Scaling factor for making the visualization darker
    //const weightScalingFactor = 99.5;  // Adjust this factor for darkness (increase for darker, decrease for lighter)

    // Apply the scaling factor to the weights
    data.forEach(d => {
        d.Weight = Math.pow(d.Weight, 0.5);  // Use Math.pow(d.Weight, 3) for cubing if needed
    });

    // Define a color scale for the heatmap with a domain centered around the median weight
    const maxWeight = d3.max(data, d => d.Weight);
    const minWeight = d3.min(data, d => d.Weight);

    // Define a custom color interpolator that will make the colors darker
    const colorInterpolator = t => {
        const start = 0.01; // Starting at 1% will make the colors generally darker
        return d3.interpolateReds(start + t * (1 - start));
    };

    // Define a continuous color scale using the custom interpolator
    const colorScale = d3.scaleSequential(colorInterpolator)
        .domain([minWeight, maxWeight]);

    // Create an SVG element inside the container for the heatmap
    const svg = container.append('svg')
        .attr('width', containerWidth)
        .attr('height', containerHeight);

    // Define a clip path to confine the heatmap within the axes
    svg.append('defs').append('clipPath')
        .attr('id', 'clip')
        .append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('x', 0)
        .attr('y', 0);

    const heatmapGroup = svg.append('g')
        .attr('transform', `translate(${offsetX + margin.left},${offsetY + margin.top})`)
        .attr('clip-path', 'url(#clip)');

    // Find the maximum value for both Source and Target in the data to set up dynamic domain
    const maxDataValue = d3.max(data, d => Math.max(d.Source, d.Target));
    const minDataValue = d3.min(data, d => Math.min(d.Source, d.Target));

    // Create scales for the heatmap to cover all bins (not just intervals of 50)
    const xScale = d3.scaleBand()
        .domain(d3.range(minDataValue, maxDataValue + 1))  // All bins included
        .range([0, width]);

    const yScale = d3.scaleBand()
        .domain(d3.range(minDataValue, maxDataValue + 1))  // All bins included
        .range([height, 0]);

    // Append the axes inside the main SVG (not the heatmapGroup)
    const xAxisGroup = svg.append("g")
        .attr("transform", `translate(${offsetX + margin.left},${offsetY + margin.top + height})`)
        .call(d3.axisBottom(xScale)
            .tickValues(d3.range(minDataValue, maxDataValue + 1, 50))  // Show labels at intervals of 50
            //.tickFormat(d => `Bin ${d}`));
            .tickFormat(d => `${d}`));

    const yAxisGroup = svg.append("g")
        .attr("transform", `translate(${offsetX + margin.left},${offsetY + margin.top})`)
        .call(d3.axisLeft(yScale)
            .tickValues(d3.range(minDataValue, maxDataValue + 1, 50))  // Show labels at intervals of 50
            .tickFormat(d => `Bin ${d}`));

    // Create heatmap squares for every bin
    const gridSizeX = xScale.bandwidth();
    const gridSizeY = yScale.bandwidth();

    // Prepare the data to ensure symmetry (upper and lower triangle)
    const symmetricalData = data.flatMap(d => [
        { Source: d.Source, Target: d.Target, Weight: d.Weight },
        { Source: d.Target, Target: d.Source, Weight: d.Weight }  // Ensure lower triangle is filled
    ]);

    heatmapGroup.selectAll('rect')
        .data(symmetricalData)
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.Source))  // Use the xScale for positioning
        .attr('y', d => yScale(d.Target))  // Use the yScale for positioning
        .attr('width', gridSizeX)          // Set width to gridSizeX
        .attr('height', gridSizeY)         // Set height to gridSizeY
        .style('fill', d => colorScale(d.Weight))
        .style('stroke-width', 0);         // No stroke for a seamless appearance

    // Define brush for rectangle selection
    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on('start', brushStart)
        .on('brush', brushing)
        .on('end', brushEnd);

    svg.append("g")
        .attr("class", "brush")
        .attr('transform', `translate(${offsetX + margin.left},${offsetY + margin.top})`)  // Adjust brush position
        .call(brush);

    // Create color map legend
    const legendHeight = height;
    const legendWidth = 20;

    const legendGroup = svg.append('g')
        .attr('transform', `translate(${offsetX + margin.left + width + 40},${offsetY + margin.top})`);  // Adjusted to move legend labels further right

    const legendScale = d3.scaleLinear()
        .domain([minWeight, maxWeight])
        .range([legendHeight, 0]);

    const legendAxis = d3.axisRight(legendScale).ticks(6);  // Fewer ticks for better spacing

    const legend = legendGroup.append("g")
        .attr("class", "legend axis")
        .attr("transform", "translate(30, 0)")  // Move the legend labels 30px to the right
        .call(legendAxis);

    const legendGradient = legendGroup.append("defs")
        .append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%")
        .attr("y1", "100%")
        .attr("x2", "0%")
        .attr("y2", "0%");

    legendGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorScale(minWeight));

    legendGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorScale(maxWeight));

    legendGroup.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)")
        .on('mousemove', function (event) {
            const legendValue = legendScale.invert(d3.pointer(event)[1]);
            const colorValue = colorScale(legendValue);  // Get the color value
    
            tooltip.style('display', 'block')
                .style('left', `${event.pageX + 10}px`)
                .style('top', `${event.pageY + 10}px`)
                .html(`Weight: ${legendValue.toFixed(6)}<br>Color: <span style="display:inline-block; width:12px; height:12px; background-color:${colorValue}; border-radius:50%;"></span>`);
        })
        .on('mouseout', function () {
            tooltip.style('display', 'none');
        });

        function brushStart(event) {
            if (event.sourceEvent.type !== 'end') {
                d3.selectAll('.selection').style('display', 'block');
                tooltip.style('display', 'none'); // Hide tooltip when brush starts
            }
        }
    
        function brushing(event) {
            const selection = event.selection;
            if (selection) {
                const [[x0, y0], [x1, y1]] = selection;
                const selectedSources = data.filter(d => xScale(d.Source) >= x0 && xScale(d.Source) <= x1);
                const selectedTargets = data.filter(d => yScale(d.Target) >= y0 && yScale(d.Target) <= y1);
                const minSource = d3.min(selectedSources, d => d.Source);
                const maxSource = d3.max(selectedSources, d => d.Source);
                const minTarget = d3.min(selectedTargets, d => d.Target);
                const maxTarget = d3.max(selectedTargets, d => d.Target);
    
                // Calculate the average weight for the selected range
                const selectedWeights = data.filter(d => xScale(d.Source) >= x0 && xScale(d.Source) <= x1 && yScale(d.Target) >= y0 && yScale(d.Target) <= y1)
                                            .map(d => d.Weight);
                const avgWeight = d3.mean(selectedWeights);
    
                tooltip.style('display', 'block')
                    .style('left', `${x1 + margin.left + 10}px`)
                    .style('top', `${y1 + margin.top + 10}px`)
                    .html(`Source: Bin ${minSource} - Bin ${maxSource}<br>Target: Bin ${minTarget} - Bin ${maxTarget}<br>Average Weight: ${avgWeight.toFixed(6)}`);
    
                // Update the selected node IDs
                selectedNodeIdsForRange = [];
                for (let i = minSource; i <= maxSource; i++) {
                    selectedNodeIdsForRange.push(i.toString());
                }
            }
        }
    
        function brushEnd(event) {
            if (!event.selection) {
                tooltip.style('display', 'none');
                return;
            }
            d3.selectAll('.selection').style('display', 'none');
        
            const selection = event.selection;
            const [[x0, y0], [x1, y1]] = selection;
            const selectedSources = data.filter(d => xScale(d.Source) >= x0 && xScale(d.Source) <= x1);
            const minSource = d3.min(selectedSources, d => d.Source);
            const maxSource = d3.max(selectedSources, d => d.Source);
        
            // Set the range values in the input boxes
            document.getElementById('fromBin').value = minSource;
            document.getElementById('toBin').value = maxSource;
        
            // Create a new mouse event to simulate the button click
            const visualizeRangeButton = document.getElementById('visualize-range');
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            });
            tooltip.style('display', 'none'); // Hide tooltip when brush ends
            visualizeRangeButton.dispatchEvent(clickEvent);
        }
    }








//////Function for Highlighting the Heatmap based on node selection/////
// Set to track selected nodes
let selectedNodes = new Set();


function updateHeatmapHighlights(svg, isRangeHighlight = false) {
    const highlightColor = '#ff5722';  // Example: bright orange
    const highlightWidth = 2;  // Stroke width for better visibility

    // Optional: Define and append an SVG filter for a glow effect
    let filter = svg.select("#glow-filter");
    if (filter.empty()) {
        const defs = svg.append("defs");
        filter = defs.append("filter")
            .attr("id", "glow-filter")
            .attr("width", "200%")
            .attr("height", "200%");
        filter.append("feGaussianBlur")
            .attr("in", "SourceAlpha")
            .attr("stdDeviation", 2.5)
            .attr("result", "blur");
        filter.append("feOffset")
            .attr("in", "blur")
            .attr("dx", 0)
            .attr("dy", 0)
            .attr("result", "offsetBlur");
        const feMerge = filter.append("feMerge");
        feMerge.append("feMergeNode")
            .attr("in", "offsetBlur");
        feMerge.append("feMergeNode")
            .attr("in", "SourceGraphic");
    }

    // Clear all previous highlights
    svg.selectAll('rect')
        .style('stroke', null)
        .style('stroke-width', 0)
        .style("filter", null)
        .style('opacity', 1);  // Reset opacity

    if (isRangeHighlight) {
        const rangeStart = Math.min(...selectedNodeIdsForRange);
        const rangeEnd = Math.max(...selectedNodeIdsForRange);

        // Highlight the entire rows and columns for rangeStart and rangeEnd
        svg.selectAll('rect')
            .filter(d => d && (d.Source == rangeStart || d.Target == rangeStart || d.Source == rangeEnd || d.Target == rangeEnd))
            .style('stroke', highlightColor)
            .style('stroke-width', highlightWidth)
            .style("filter", "url(#glow-filter)");  // Apply the glow effect
    } else {
        selectedNodes.forEach(nodeId => {
            svg.selectAll('rect')
                .filter(d => d && (d.Source == nodeId || d.Target == nodeId))
                .style('stroke', highlightColor)
                .style('stroke-width', highlightWidth)
                .style("filter", "url(#glow-filter)")  // Apply the glow effect
                .style('opacity', 0.1);  // Set opacity to make the highlight transparent
        });
    }
}





////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////
/////////////////////////For 3d Vis////////////////////////


   //////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////
    ////////////            3D Visualization Setup      /////////////////////////////
    // Setup Three.js scene, camera, renderer, and controls
// Setup Three.js scene, camera, renderer, and controls
// Setup Three.js scene, camera, renderer, and controls

scene = new THREE.Scene();

const visualizationContainer = document.getElementById('visualization1');
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0); // Transparent background

const margin = { top: 10, right: 10, bottom: 30, left: 10 }; // Adjust margin values as needed

renderer.setSize(visualizationContainer.clientWidth - margin.left - margin.right, visualizationContainer.clientHeight - margin.top - margin.bottom);
console.log("Renderer dimensions:", visualizationContainer.clientWidth - margin.left - margin.right, visualizationContainer.clientHeight - margin.top - margin.bottom);
visualizationContainer.appendChild(renderer.domElement);

camera = new THREE.PerspectiveCamera(45, (visualizationContainer.clientWidth - margin.left - margin.right) / (visualizationContainer.clientHeight - margin.top - margin.bottom), 0.1, 1000);
camera.position.set(0, 0, 100); // Move the camera further away
camera.lookAt(new THREE.Vector3(0, 0, 0));
camera.updateProjectionMatrix();

const ambientLight = new THREE.AmbientLight(0xaaaaaa);
scene.add(ambientLight);

const light = new THREE.PointLight(0xffffff, 1);
light.position.set(50, 50, 50);
scene.add(light);

controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = true; // Enable panning
controls.enableZoom = true; // Enable zooming
controls.zoomSpeed = 1.2; // Adjust the zoom speed
controls.panSpeed = 1.0; // Adjust the pan speed
controls.enableDamping = false; // Enable damping for smoother movement
controls.dampingFactor = 0.0003; // Adjust damping factor


//Axis Helper for showing x,y,z axes in 3d vis
//after initializing the scene and renderer
// Create a small scene for the axes helper
//It will show a red line for the x-axis, a green line for the y-axis, and a blue line for the z-axis.
const axesScene = new THREE.Scene();
const axesHelper = new THREE.AxesHelper(2); // Size of the axes helper
axesScene.add(axesHelper);

// Create a smaller camera for the axes helper
const axesCamera = new THREE.PerspectiveCamera(
    50, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    1000 // Far clipping plane
);
axesCamera.up = camera.up; // Use the same up direction as the main camera

// Create a smaller renderer for the axes helper
const axesRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
axesRenderer.setSize(100, 100); // Size of the axes helper renderer
axesRenderer.setClearColor(0x000000, 0); // Transparent background

// Position the axes renderer within the visualization container
axesRenderer.domElement.style.position = 'absolute';
axesRenderer.domElement.style.bottom = '10px'; // Position at the bottom
axesRenderer.domElement.style.left = '10px'; // Position at the left

// Append the axes renderer to the visualization container
visualizationContainer.appendChild(axesRenderer.domElement);


function onWindowResize() {
    camera.aspect = (visualizationContainer.clientWidth - margin.left - margin.right) / (visualizationContainer.clientHeight - margin.top - margin.bottom);
    camera.updateProjectionMatrix();
    renderer.setSize(visualizationContainer.clientWidth - margin.left - margin.right, visualizationContainer.clientHeight - margin.top - margin.bottom);
}

window.addEventListener('resize', onWindowResize, false);
onWindowResize();  // Call initially to set size.

scene.background = new THREE.Color(0xf0f0f0);

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    controls.update(); // Needed if controls.enableDamping or controls.autoRotate are set to true

    // Render the main scene
    renderer.render(scene, camera);

    // Update the axes camera to match the main camera's orientation
    axesCamera.position.copy(camera.position);
    axesCamera.position.sub(controls.target); // Translate to the camera's position relative to the target
    axesCamera.position.setLength(5); // Set the distance of the camera from the origin
    axesCamera.lookAt(axesScene.position); // Look at the origin (0,0,0) of the axesScene

    // Render the axes helper scene
    axesRenderer.render(axesScene, axesCamera);
}
animate();

// For Creating Nodes for 3d Visualization
function createNodes(nodeData) {
    // Clear existing nodes and labels in the scene
    while (scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }

    const labelNodeIds = [1, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 568]; // IDs of nodes to label

    // Sort nodes by numeric ID
    const sortedData = nodeData.slice().sort((a, b) => parseInt(a.id.replace(/[^\d]/g, '')) - parseInt(b.id.replace(/[^\d]/g, '')));
    const startNode = sortedData[0];
    const endNode = sortedData[sortedData.length - 1];

    nodeData.forEach(node => {
        const numericId = node.id.replace(/[^\d]/g, ''); // Assumes node.id is like 'Node1'
        let nodeColor;

        // Assign color based on ChID without using any extra function
        if (node.ChID === 1) {
            nodeColor = 0xFF0000; // Red for ChID 1
        } else if (node.ChID === 2) {
            nodeColor = 0x00FF00; // Green for ChID 2
        } else if (node.ChID === 3) {
            nodeColor = 0x800080; // Purple for ChID 3
        } else if (node.ChID === 4) {
            nodeColor = 0x00008B; // Dark Blue for ChID 4
        } else {
            nodeColor = 0xFFFFFF; // Default color (white) if ChID doesn't match any case
        }

        // Set up the material with different colors for start and end nodes
        let nodeMaterial;
        if (node === startNode) {
            nodeMaterial = new THREE.MeshStandardMaterial({
                color: 0xAAAA00, // Green color for start node
                emissive: 0xAAAA00, // Same color for emissive to create a glow effect
                emissiveIntensity: 1,
                roughness: 0.1,
                metalness: 0.5
            });
        } else if (node === endNode) {
            nodeMaterial = new THREE.MeshStandardMaterial({
                color: 0x001111, // Blue color for end node
                emissive: 0x001111,
                emissiveIntensity: 1,
                roughness: 0.1,
                metalness: 0.5
            });
        } else {
            // Use the color based on ChID for other nodes
            nodeMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color(nodeColor), // Apply color based on ChID
                emissive: new THREE.Color(nodeColor),
                emissiveIntensity: 1,
                roughness: 0.1,
                metalness: 0.5
            });
        }

        // Reduce the node size to half
        const geometry = new THREE.SphereGeometry(0.35, 32, 32); // Node radius set to 0.35
        const sphere = new THREE.Mesh(geometry, nodeMaterial);
        sphere.position.set(node.x * 0.1, node.y * 0.1, node.z * 0.1);
        sphere.name = numericId;
        sphere.userData = { ChID: node.ChID };  // Store ChID in userData for future reference
        scene.add(sphere);

        // Add labels for specific nodes
        if (labelNodeIds.includes(parseInt(numericId))) {
            const label = createLabelSprite(`Bin ${numericId}`);
            label.position.set(node.x * 0.1, node.y * 0.1, node.z * 0.1);
            scene.add(label);
        }
    });

    renderer.render(scene, camera);
}



// Helper function to create a text sprite for labels
function createLabelSprite(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = 'Bold 50px Arial';
    context.fillStyle = 'rgba(0, 0, 0, 1.0)';
    context.fillText(text, 0, 50);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(5, 2.5, 1.0); // Scale the sprite appropriately

    return sprite;
}


    
    //Updating Tooltip for 3d Visualization
    let lastHighlightedNode = null;

    // Function to update the tooltip for 3D visualization
    function updateTooltip(event, node) {
        const tooltip = document.getElementById('tooltip3D');
        if (node) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${event.clientX + 10}px`;
            tooltip.style.top = `${event.clientY + 10}px`;
            tooltip.innerHTML = `Bin: ${node.name}`;
        } else {
            tooltip.style.display = 'none';
        }
    }
    
    // Function for mouse hover on 3D visualization
    renderer.domElement.addEventListener('mousemove', function(event) {
        var rect = renderer.domElement.getBoundingClientRect();  // Get the bounding rectangle of renderer
    
        // Convert mouse position to NDC
        var mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
        // Update the picking ray with the camera and mouse position
        var raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
    
        // Perform raycasting
        var intersects = raycaster.intersectObjects(scene.children);
    
        if (intersects.length > 0) {
            let hoveredNode = intersects[0].object;
    
            if (lastHighlightedNode && lastHighlightedNode !== hoveredNode) {
                // Reset the previous highlighted node's color
                lastHighlightedNode.material.emissive.setHex(lastHighlightedNode.material.color.getHex());
            }
    
            // Highlight the new hovered node
            hoveredNode.material.emissive.setHex(0xffff00); // Highlight the node
    
            // Update tooltip
            updateTooltip(event, hoveredNode);
    
            // Store the current hovered node as the last highlighted node
            lastHighlightedNode = hoveredNode;
        } else {
            if (lastHighlightedNode) {
                // Reset the previous highlighted node's color
                lastHighlightedNode.material.emissive.setHex(lastHighlightedNode.material.color.getHex());
                lastHighlightedNode = null;
            }
            
            // Hide tooltip when not hovering over any node
            updateTooltip(event, null);
        }
    });
    
    
    
    // For Mouse Click Function- Must have; It control the mouse click in the node selection dropdown menu as well
        function onCanvasClick(event) {
            var mouse = new THREE.Vector2();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
        
            console.log("Mouse NDC Position:", mouse.x, mouse.y); // Debug mouse positions
        
            var raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
        
            var intersects = raycaster.intersectObjects(scene.children);
            console.log("Intersections found:", intersects.length); // Debug number of intersections
        
            if (intersects.length > 0) {
                if (selectedNode) {
                    selectedNode.material.emissive.setHex(0x000000);
                }
        
                selectedNode = intersects[0].object;
                selectedNode.material.emissive.setHex(0xff0000);
                console.log("Clicked on node: " + selectedNode.name); // Should log when a node is clicked
            }
        }
        
        //// Gene Density Function///
        async function fetchGeneDensityData(filePath) {
            try {
                console.log("Fetching gene density data...");
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                console.log("Gene density data fetched successfully:", data);
                window.geneDensityData = data;
            } catch (error) {
                console.error("Error fetching gene density data:", error);
            }
        }
        
        function drawGeneDensityLines(svg, width, height, margin, xScale, yScale) {
            // Ensure gene density data is available
            if (!window.geneDensityData) {
                console.error("Gene density data not available");
                return;
            }
        
            const colorScale = d3.scaleSequential(d3.interpolateReds)
                .domain([0, d3.max(window.geneDensityData, d => d.density)]);
        
            // Create a group for the gene density lines
            const geneDensityGroup = svg.append('g')
                .attr('class', 'gene-density-group')
                .attr('transform', `translate(${margin.left},${margin.top})`);
        
            // Add a tooltip div. Initially hidden.
            const tooltip = d3.select('body').append('div')
                .attr('class', 'tooltip')
                .style('position', 'absolute')
                .style('padding', '6px')
                .style('background', 'lightgray')
                .style('border', '1px solid #333')
                .style('border-radius', '4px')
                .style('pointer-events', 'none')
                .style('display', 'none');
        
            // Draw the gene density line at the bottom
            geneDensityGroup.selectAll('.density-line-bottom')
                .data(window.geneDensityData)
                .enter()
                .append('rect')
                .attr('class', 'density-line-bottom')
                .attr('x', d => xScale(d.node))
                .attr('y', height + margin.bottom / 2) // Slightly above the x-axis
                .attr('width', width / window.geneDensityData.length) // Adjust width to fit within the x-axis
                .attr('height', margin.bottom / 4) // Height of the density line
                .attr('fill', d => colorScale(d.density))
                .on('mouseover', function(e, d) {
                    tooltip.style('display', 'block');
                    tooltip.html(`Bin: ${d.node}<br>Density: ${d.density}`);
                })
                .on('mousemove', function(e) {
                    tooltip.style('left', (e.pageX + 10) + 'px')
                        .style('top', (e.pageY - 20) + 'px');
                })
                .on('mouseout', function() {
                    tooltip.style('display', 'none');
                });
        }

        
        ///////////////////////////////////////////////////////////////////////////////////////
        // Function for updating gene density line with zoom in or out in heatmap visualization

        // function updateGeneDensityLines(svg, width, height, margin, newXScale, zoomLevel) {
        //     // Ensure gene density data is available
        //     if (!window.geneDensityData) {
        //         console.error("Gene density data not available");
        //         return;
        //     }
        
        //     const colorScale = d3.scaleSequential(d3.interpolateReds)
        //         .domain([0, d3.max(window.geneDensityData, d => d.density)]);
        
        //     // Update the gene density line at the bottom based on the zoom level
        //     svg.selectAll('.density-line-bottom')
        //         .data(window.geneDensityData)
        //         .attr('x', d => newXScale(d.node))
        //         .attr('width', zoomLevel === 1 ? width / window.geneDensityData.length : newXScale(d.node + 1) - newXScale(d.node));
        // }
        
        /////////////////////////////////////////////////////////////////////////////////////////////////////
        
        ///////////Gene density drawing for Parallel Plot/////////////
        function drawGeneDensityLinesParallelPlot(svg, width, height, margin, combinedNodes, sourceScale, targetScale) {
            // Ensure gene density data is available
            if (!window.geneDensityData) {
                console.error("Gene density data not available");
                return;
            }
        
            const colorScale = d3.scaleSequential(d3.interpolateReds)
                .domain([0, d3.max(window.geneDensityData, d => d.density)]);
        
            const tooltip = d3.select("#tooltipParallelPlot");
        
            // Draw gene density line along the left axis (shifted left)
            svg.selectAll(".density-line-left")
                .data(window.geneDensityData)
                .enter()
                .append("rect")
                .attr("class", "density-line-left")
                .attr("x", -20) // Position it outside the left margin
                .attr("y", d => sourceScale(d.node))
                .attr("width", 20)
                .attr("height", height / combinedNodes.length)
                .style("fill", d => colorScale(d.density))
                .on('mouseover', function (e, d) {
                    tooltip.style('display', 'block')
                           .html(`Node: ${d.node}<br>Density: ${d.density}`);
                })
                .on('mousemove', function (e) {
                    tooltip.style('left', (e.pageX + 10) + 'px')
                           .style('top', (e.pageY - 20) + 'px');
                })
                .on('mouseout', function () {
                    tooltip.style('display', 'none');
                });
        
            // Draw gene density line along the right axis (shifted right)
            svg.selectAll(".density-line-right")
                .data(window.geneDensityData)
                .enter()
                .append("rect")
                .attr("class", "density-line-right")
                .attr("x", width) // Position it at the right edge of the plot
                .attr("y", d => targetScale(d.node))
                .attr("width", 10)
                .attr("height", height / combinedNodes.length)
                .style("fill", d => colorScale(d.density))
                .on('mouseover', function (e, d) {
                    tooltip.style('display', 'block')
                           .html(`Node: ${d.node}<br>Density: ${d.density}`);
                })
                .on('mousemove', function (e) {
                    tooltip.style('left', (e.pageX + 10) + 'px')
                           .style('top', (e.pageY - 20) + 'px');
                })
                .on('mouseout', function () {
                    tooltip.style('display', 'none');
                });
        }

        ///For Highlighting 3d nodes upon selection ///

        function highlightNodes3D(nodeIds) {
            scene.children.forEach(child => {
                if (child.isMesh) {
                    const numericId = child.name; // Assuming node ID is stored in the name property
                    if (nodeIds.includes(numericId)) {
                        // Highlight the node by setting the color to yellow (or any highlight color)
                        child.material.color.set(0xFFAA18); // Highlight color, e.g., yellow
                        child.material.emissive.set(0xFFAA18); // Set emissive color to match the highlight color
                    } else {
                        // Hardcode the colors for nodes based on their ChID stored in userData
                        let nodeColor;
                        if (child.userData.ChID === 1) {
                            nodeColor = 0xFF0000; // Red for ChID 1
                        } else if (child.userData.ChID === 2) {
                            nodeColor = 0x00FF00; // Green for ChID 2
                        } else if (child.userData.ChID === 3) {
                            nodeColor = 0x800080; // Purple for ChID 3
                        } else if (child.userData.ChID === 4) {
                            nodeColor = 0x00008B; // Dark Blue for ChID 4
                        } else {
                            nodeColor = 0xFFFFFF; // Default white color if ChID is not specified
                        }
                        child.material.color.set(nodeColor); // Set node color based on hardcoded ChID
                        child.material.emissive.set(nodeColor); // Set emissive color to match node color
                    }
                }
            });
        
            renderer.render(scene, camera); // Re-render the scene
        }
        
        
        
        
        
        ///////////Functionality for Clear Button/////
        function clearVisualizations() {
            // Clear 3D scene
            while (scene.children.length > 0) { 
                scene.remove(scene.children[0]); 
            }
            renderer.render(scene, camera);
        
            // Clear 2D canvas
            const canvas2D = document.getElementById('canvas2D');
            if (canvas2D) {
                const context = canvas2D.getContext('2d');
                context.clearRect(0, 0, canvas2D.width, canvas2D.height);
            }
        
            // Clear heatmap visualization
            const heatmapSVG = d3.select('#visualization3').select('svg');
            if (!heatmapSVG.empty()) {
                heatmapSVG.selectAll('*').remove();
            }
        
            // Clear parallel plot visualization
            const parallelPlotSVG = d3.select('#visualization4').select('svg');
            if (!parallelPlotSVG.empty()) {
                parallelPlotSVG.selectAll('*').remove();
            }
        
            // Reset dataset selector
            document.getElementById('dataset-selector').value = '';
        
            // Reset node checkboxes
            const nodeCheckboxes = document.querySelectorAll('#node-checkboxes input[type="checkbox"]');
            nodeCheckboxes.forEach(checkbox => checkbox.checked = false);

            //Disselect for interaction checkboxes
            const interactionCheckboxes = document.querySelectorAll('input[name="interaction"]');
            interactionCheckboxes.forEach(checkbox => checkbox.checked = false);


            // Clear other selections and controls if any
            // Reset edge weight slider value
            const edgeWeightSlider = document.getElementById('edgeWeightSlider');
            edgeWeightSlider.value = 100;
            document.getElementById('edgeWeightValue').textContent = '100%';
        
            // Reset opacity slider value
            const linkOpacitySlider = document.getElementById('linkOpacitySlider');
            linkOpacitySlider.value = 100; // Assuming the initial value is 70%
            document.getElementById('linkOpacityValue').textContent = '100%';
            d3.selectAll('path').attr('opacity', 1.0); // Reset the opacity of links
        
            // Reset bin range inputs
            document.getElementById('fromBin').value = '';
            document.getElementById('toBin').value = '';
        
            // Clear any remaining tooltip
            const tooltips = document.querySelectorAll('.tooltip');
            tooltips.forEach(tooltip => tooltip.style.display = 'none');
        
            // Optionally, reinitialize nodes (without edges)
            // fetchNodesFromJson('WT_BS_Node_3D.json'); // Uncomment if you want to reload nodes
            clearLocalStorage();
        }
        
        document.getElementById('clear-visualizations').addEventListener('click', clearVisualizations);
        
        