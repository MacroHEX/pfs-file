# PFS Extractor (Electron GUI)

A graphical application for decrypting and extracting .pfs game resource files. This tool is based on the original
script by [Xmader](https://github.com/Xmader) but has been adapted to an Electron-based GUI for ease of use.

## Features

- Decrypt and Extract: Automatically extracts .pfs game resource files.
- Graphical User Interface (GUI): No need for command-line operations.
- Auto-Detect Encryption Key: Attempts to guess the decryption key based on PNG or OGG file headers.
- Output Directory Selection: Choose where extracted files will be saved.

## Installation

### Prerequisites

Ensure you have **Node.js** and **pnpm** installed. You can install `pnpm` globally with:

```sh
npm install -g pnpm
```

#### Install Dependencies

```sh
pnpm install
```

## Usage

### Running the Application

```sh
pnpm run dev
```

This will open the Electron-based GUI, where you can select a `.pfs` file and extract its contents.

## Building a Standalone Application

To build an executable for your operating system:

```sh
pnpm run build
```

The compiled application will be placed in the `release` folder.

## How It Works

1. The user selects a `.pfs` file.
2. The application analyzes the file and attempts to determine its encryption key.
3. The extracted files are saved in the selected output directory.
4. Users can view and access the extracted files.

## Credits

This project is based on the original [pfs-file](https://github.com/Xmader/pfs-file) extraction script by Xmader, which
provides the core logic for parsing
`.pfs` files. This Electron-based GUI implementation is designed for ease of use and accessibility.

## License

This project follows the same licensing terms as the original [pfs-file](https://github.com/Xmader/pfs-file) repository.
Refer to the original project for
details.