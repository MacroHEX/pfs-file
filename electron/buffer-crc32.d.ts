declare module "buffer-crc32" {
  function crc32(data: Buffer | string, partial?: boolean): Buffer;

  export = crc32;
}
