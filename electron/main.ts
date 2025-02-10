import {app, BrowserWindow, dialog, ipcMain} from 'electron'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import * as fs from "node:fs";
import crc32 from "buffer-crc32";

createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    frame: false, // Removes the window menu from the app
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true, // Ensures cotext isolation for security
      nodeIntegration: false, // Prevents remote code execution risks
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL).then()
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html')).then()
  }
}

// Add IPC handler for file selection
app.whenReady().then(() => {
  createWindow();

  ipcMain.on('app:close', () => {
    app.quit()
  })

  ipcMain.on("app:minimize", () => {
    if (win) win.minimize();
  });

  // Compute the output directory based on the input file path
  ipcMain.handle("computeOutputDirectory", async (_event, filePath) => {
    try {
      const fileDir = path.dirname(filePath);
      const fileName = path.basename(filePath, path.extname(filePath));

      // Just return the path
      return path.join(fileDir, fileName);
    } catch (error) {
      console.error("Error computing output directory:", error);
      return null;
    }
  });

  ipcMain.handle("createDirectory", async (_event, outputDir) => {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
      }
      return outputDir;
    } catch (error) {
      console.error("Error creating directory:", error);
      return null;
    }
  });

  ipcMain.handle('dialog:openFile', async (_event, options) => {
    return await dialog.showOpenDialog(win!, options);
  });

  ipcMain.handle('dialog:openDirectory', async (_event, options) => {
    return await dialog.showOpenDialog(win!, options);
  });

  type ExtractFilesResponse = {
    success: boolean;
    message: string;
  };

  ipcMain.handle(
    "files:extract",
    async (_event, filePath: string, outputDir: string): Promise<ExtractFilesResponse> => {
      try {
        if (!fs.existsSync(filePath)) {
          return {success: false, message: "PFS file not found"};
        }

        // Read the PFS file
        const pfsdata = fs.readFileSync(filePath);
        const pfsdataView = new DataView(pfsdata.buffer);

        // Define file structure type
        interface PfsFile {
          name: string;
          offset: number;
          size: number;
        }

        // Get file list from the PFS archive
        const getFileList = (): PfsFile[] => {
          let offset = 3; // Skipping "pf8" file header
          offset += 4; // INFO_SIZE long

          const fileCount = pfsdataView.getUint32(offset, true);
          offset += 4;

          const files: PfsFile[] = [];
          for (let i = 0; i < fileCount; i++) {
            const namesz = pfsdataView.getUint32(offset, true);
            offset += 4;

            const filenameData = pfsdata.slice(offset, offset + namesz);
            const filename = new TextDecoder().decode(filenameData);
            offset += namesz;

            offset += 4; // Skipping ZERO long

            const fileOffset = pfsdataView.getUint32(offset, true);
            offset += 4;

            const fileSize = pfsdataView.getUint32(offset, true);
            offset += 4;

            files.push({
              name: filename.replace(/\\/g, "/"), // Convert Win32 style path
              offset: fileOffset,
              size: fileSize,
            });
          }
          return files;
        };

        const FILES: PfsFile[] = getFileList();

        // Get file data based on offset and size
        const getFileData = (fileinfo: PfsFile): Buffer => {
          return pfsdata.slice(fileinfo.offset, fileinfo.offset + fileinfo.size);
        };

        // Guess encryption key
        const KEYSZ = 20;

        const PNG_HEADER = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
        ]);

        const PNG_CHUNK_TYPES = [
          "PLTE", "IDAT", "bKGD", "cHRM", "dSIG", "eXIf", "gAMA", "hIST", "iCCP",
          "iTXt", "pHYs", "sBIT", "sPLT", "sRGB", "sTER", "tEXt", "tIME", "tRNS", "zTXt"
        ];

        const OGG_HEADER = new Uint8Array([
          79, 103, 103, 83, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        ]);

        const guessEncryptionKeyByPng = (): Uint8Array | null => {
          const key = new Uint8Array(KEYSZ);

          // Pick a PNG file
          const info = FILES.find(({name}) => name.endsWith(".png"));
          if (!info) return null;
          const data = getFileData(info);

          // Get first 16 bytes of XOR key
          for (let i = 0; i < PNG_HEADER.length; i++) {
            key[i] = PNG_HEADER[i] ^ data[i];
          }

          // Calculate remaining 4 bytes using CRC
          const ihdrEncrypted = data.slice(8, 8 + 4 + 4 + 13 + 4);
          const ihdr = ihdrEncrypted.map((d, i) => d ^ key[(i + 8) % 20]);
          const crc = ihdr.slice(-4);

          // Guess actual chunk type
          const tl = String.fromCharCode(data[40] ^ key[0]);
          const possibleChunkTypes = PNG_CHUNK_TYPES.filter(t => t.endsWith(tl));

          const toCalc = Buffer.from(ihdr.slice(4, 4 + 4 + 13));

          guessKey:
            for (const t of possibleChunkTypes) {
              key[17] = t[0].charCodeAt(0) ^ data[37];
              key[18] = t[1].charCodeAt(0) ^ data[38];
              key[19] = t[2].charCodeAt(0) ^ data[39];

              for (let k = 0; k < 256; k++) {
                key[16] = k;

                for (let i = 0; i < 4; i++) {
                  toCalc[4 + i] = data[16 + i] ^ key[16 + i];
                }

                if (crc32(toCalc).equals(crc)) {
                  break guessKey;
                }
              }
            }
          return key;
        };

        const guessEncryptionKeyByOgg = (): Uint8Array | null => {
          const key = new Uint8Array(KEYSZ);

          // Pick an OGG file
          const info = FILES.find(({name}) => name.endsWith(".ogg"));
          if (!info) return null;
          const data = getFileData(info);

          for (let i = 0; i < OGG_HEADER.length; i++) {
            key[i] = OGG_HEADER[i] ^ data[i];
          }

          key[14] = (data[72] ^ key[72 % 20]) ^ data[14];
          key[15] = (data[73] ^ key[73 % 20]) ^ data[15];

          return key;
        };

        const KEY: Uint8Array | null = guessEncryptionKeyByPng() || guessEncryptionKeyByOgg();
        if (!KEY) return {success: false, message: "Failed to determine encryption key."};

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, {recursive: true});
        }

        // Extract and decrypt files
        FILES.forEach((f) => {
          const fileData = getFileData(f);
          const decrypted = fileData.map((d, i) => d ^ KEY[i % 20]);

          const filePath = path.join(outputDir, f.name);
          fs.mkdirSync(path.dirname(filePath), {recursive: true});

          fs.writeFileSync(filePath, decrypted);
        });

        return {success: true, message: "Extraction complete!"};
      } catch (error) {
        console.error("Error extracting files:", error);
        return {
          success: false,
          message: error instanceof Error ? error.message : "Unknown error occurred",
        };
      }
    }
  );

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
