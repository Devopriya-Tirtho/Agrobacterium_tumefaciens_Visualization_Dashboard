self.addEventListener('message', function(e) {
    try {
        const data = e.data;
        console.log('Worker received data:', data); // Log received data
        const processedData = processData(data);
        console.log('Worker processed data:', processedData); // Log processed data
        self.postMessage(processedData);
    } catch (error) {
        console.error('Error in worker:', error);
        self.postMessage({ error: error.message });
    }
});

function processData(data) {
    // Implement your data processing logic
    // For example, let's say you want to filter data
    return data.filter(d => d.Weight > 0);
}
