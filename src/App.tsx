import {useState} from "react";
import {AiOutlineCloudUpload, AiOutlineFolderOpen} from "react-icons/ai";
import {FaPlay} from "react-icons/fa";

function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [outputDirectory, setOutputDirectory] = useState<string | null>(null);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);


  // Open file selection dialog
  const openFileDialog = async () => {
    try {
      const filePath = await window.ipcRenderer.selectFile({
        properties: ["openFile"],
        filters: [{name: "PFS Files", extensions: ["pfs", "pfs.*"]}],
      });

      if (filePath) {
        setSelectedFile(filePath);

        // Compute default output directory (but don't create it)
        const outputDir = await window.ipcRenderer.invoke(
          "computeOutputDirectory",
          filePath
        );
        setOutputDirectory(outputDir as string);
      }
    } catch (error) { /* empty */
    }
  };

  // Open output directory selection dialog
  const selectOutputDirectory = async () => {
    try {
      const dirPath = await window.ipcRenderer.selectOutputDir({
        properties: ["openDirectory"],
      });

      if (dirPath) {
        setOutputDirectory(dirPath);
      }
    } catch (error) { /* empty */
    }
  };

  type ExtractFilesResponse = {
    success: boolean;
    message: string;
  };

  const extractFiles = async () => {
    if (selectedFile && outputDirectory) {
      setIsProcessing(true); // Set processing state to true
      setExtractionMessage(null); // Clear previous messages

      const result: ExtractFilesResponse = await window.ipcRenderer.invoke<ExtractFilesResponse>(
        "files:extract",
        selectedFile,
        outputDirectory
      );

      if (result.success) {
        setExtractionMessage("✅ Extraction completed successfully!");
      } else {
        setExtractionMessage(`❌ Extraction failed: ${result.message}`);
      }

      setIsProcessing(false); // Reset processing state
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200">
      {/* Title Bar */}
      <div className="flex items-center justify-between w-full h-10 bg-gray-200 dark:bg-gray-900 px-4 drag">
        <div className="flex gap-2">
          <div
            className="w-3 h-3 bg-red-500 rounded-full hover:bg-red-600 cursor-pointer no-drag"
            onClick={() => window.ipcRenderer.send("app:close")}
          />
          <div
            className="w-3 h-3 bg-yellow-400 rounded-full hover:bg-yellow-500 cursor-pointer no-drag"
            onClick={() => window.ipcRenderer.send("app:minimize")}
          />
        </div>
        <p className="text-sm select-none">PFS Extractor</p>
        <div className="w-10"></div>
        {/* Spacing */}
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-grow p-6">
        {/* File Selection */}
        <button
          onClick={openFileDialog}
          disabled={isProcessing}
          className={`flex items-center gap-2 px-6 py-3 text-lg font-medium text-white bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-900 transition duration-300`}
        >
          <AiOutlineCloudUpload className="w-6 h-6"/>
          {selectedFile ? "Change PFS File" : "Select PFS File"}
        </button>

        {/* Display Selected File */}
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
          {selectedFile || "No file selected"}
        </p>

        {/* Output Directory Selection */}
        <div className="mt-6 flex flex-col items-center">
          <p className="text-sm mb-2">Output Directory:</p>
          <div className="flex items-center gap-2">
            <p
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg w-4/5 text-center truncate"
            >
              {outputDirectory || "No directory selected"}
            </p>
            <button
              onClick={selectOutputDirectory}
              disabled={isProcessing}
              className={`p-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition duration-300`}
            >
              <AiOutlineFolderOpen className="w-5 h-5"/>
            </button>
          </div>
        </div>

        {/* Extract Files Button */}
        <button
          onClick={extractFiles}
          disabled={isProcessing || !selectedFile || !outputDirectory}
          className={`mt-6 px-6 py-3 flex items-center gap-2 text-lg font-medium text-white bg-green-600 rounded-lg shadow-lg hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 dark:focus:ring-green-900 transition duration-300 ${
            isProcessing || !selectedFile || !outputDirectory
              ? "opacity-50 cursor-not-allowed"
              : ""
          }`}
        >
          <FaPlay className="w-5 h-5"/>
          Extract Files
        </button>

        {extractionMessage && (
          <p className="mt-4 text-sm font-medium text-gray-800 dark:text-gray-300">
            {extractionMessage}
          </p>
        )}

      </div>
    </div>
  );
}

export default App;
