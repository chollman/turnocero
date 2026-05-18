// Stub for `server/config/cloudinary`. Apply in a test with:
//   vi.mock('../../config/cloudinary', () => require('../mocks/cloudinary'));
// `vi` is provided as a global via vitest's `globals: true`.

const uploadToCloudinary = vi.fn(async (_buffer, options = {}) => ({
  secure_url: `https://mock.cloudinary/${options.folder || 'misc'}/${options.public_id || 'asset'}.jpg`,
  public_id: `${options.folder || 'misc'}/${options.public_id || 'asset'}`,
  resource_type: 'image',
  bytes: 1024,
  width: 400,
  height: 400,
  format: 'webp',
}));

const cloudinary = {
  uploader: {
    destroy: vi.fn(async () => ({ result: 'ok' })),
    upload_stream: vi.fn(),
  },
  api: {},
  config: vi.fn(),
};

module.exports = { uploadToCloudinary, cloudinary, __resetMocks() {
  uploadToCloudinary.mockClear();
  cloudinary.uploader.destroy.mockClear();
}};
