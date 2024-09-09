# Visualization Dashboard for HiC Data

## Overview

This project is a comprehensive visualization dashboard designed to interactively display data related to BacillusS. The dashboard supports multiple types of visualizations, including 3D and 2D graph visualizations, heatmaps, and parallel plots. Users can interact with the data through various controls such as sliders, checkboxes, and range selectors.

## Features

- **3D Graph Visualization**: Display nodes and edges in a three-dimensional space with interactive controls.
- **2D Graph Visualization**: Display nodes and edges in a two-dimensional space with interactive controls.
- **Heatmap Visualization**: Show data density and correlations in a heatmap format.
- **Parallel Plot Visualization**: Visualize relationships between nodes in a parallel plot format.
- **Interaction Type Filtering**: Filter edges based on intra-interaction and inter-interaction types.
- **Dynamic Data Loading**: Load datasets dynamically and visualize them on the fly.
- **Responsive Design**: Adaptable layout for various screen sizes (excluding phone and tablet).

## Installation

1. **Clone the repository**:
    ```sh
    git clone [https://github.com/Devopriya-Tirtho/DashboardDevelopment_ResearchWork.git](https://github.com/Devopriya-Tirtho/Visualization-Dashboard-for-Brassica-napus.git)
    cd visualization-dashboard
    ```

2. **Install dependencies**:
    Ensure you have `npm` and `node` installed, then run:
    ```sh
    npm install
    ```

3. **Start the development server**:
    ```sh
    npm start
    ```

## Usage

### Dataset Selection

1. **Select Dataset**: Use the dropdown to select the dataset (`Brassica napus (Canola/Rapeseed` for Brassica napus).
2. **Loading Placeholders**: Upon selecting a dataset, placeholder images will appear indicating the loading process. The actual visualizations will replace these placeholders once the data is fully loaded.

### Node Selection

1. **Node List**: Click the "Node List" button to open the dropdown of available nodes.
2. **Select Nodes**: Check the nodes you wish to visualize.
3. **Apply Selection**: Click the "Apply" button to visualize the selected nodes.

### Range Selection

1. **From Bin**: Enter the starting bin number.
2. **To Bin**: Enter the ending bin number.
3. **Apply**: Click the "Apply" button to visualize nodes within the specified range.

### Edge and Opacity Controls

1. **Top x% Edges**: Use the slider to select the top percentage of edges by weight to visualize.
2. **Opacity (%)**: Use the slider to adjust the opacity of the edges.

### Interaction Type

1. **Interaction Type**: Select either "Intra-interaction" or "Inter-interaction" to filter edges by interaction type.
2. **Apply**: Click the "Apply" button to apply the filter.

### Clear Visualizations

- **Clear All**: Click the "Clear Visualizations" button to reset all visualizations and selections.

## Code Structure

- **index.html**: Main HTML file containing the layout and structure of the dashboard.
- **style.css**: CSS file for styling the dashboard.
- **script.js**: Main JavaScript file containing the logic for data fetching, visualization, and interaction handling.

### Key Functions in `script.js`

- **fetchNodesFromJson**: Fetches node data for 3D visualization.
- **fetchNodesFromJson2D**: Fetches node data for 2D visualization.
- **fetchProcessedEdgeData**: Fetches and processes edge data for all visualizations.
- **setupParallelPlotData**: Prepares and initializes the parallel plot visualization.
- **clearVisualizations**: Clears all visualizations and resets controls.
- **draw2DVisualization**: Draws the 2D graph visualization.
- **createEdges3D**: Creates and renders 3D edges.
- **drawEdges2D**: Draws 2D edges on the canvas.
- **addOpacityControl**: Adds and manages the opacity slider control.

## Contributions

Contributions are welcome! Please feel free to submit issues, fork the repository, and open pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
