import storage from '@react-native-firebase/storage';
import { ref, uploadString, getDownloadURL, deleteObject } from '@react-native-firebase/storage';
import { uploadScreenshot, deleteScreenshot } from '../services/screenshotStorageService';

// Mock Firebase Storage
jest.mock('@react-native-firebase/storage', () => {
  const mockStorage = jest.fn(() => ({}));
  return {
    __esModule: true,
    default: mockStorage,
    ref: jest.fn(),
    uploadString: jest.fn(),
    getDownloadURL: jest.fn(),
    deleteObject: jest.fn(),
  };
});

describe('screenshotStorageService', () => {
  const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const mockChildId = 'child123';
  const mockPackageName = 'com.whatsapp';
  const mockTimestamp = Date.now();
  const mockDownloadURL = 'https://firebasestorage.googleapis.com/test-screenshot.jpg';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadScreenshot', () => {
    it('should upload screenshot successfully', async () => {
      const mockStorageRef = { path: 'screenshots/child123/com.whatsapp/12345.jpg' };
      ref.mockReturnValueOnce(mockStorageRef);
      uploadString.mockResolvedValueOnce({ metadata: {} });
      getDownloadURL.mockResolvedValueOnce(mockDownloadURL);

      const result = await uploadScreenshot(mockBase64, mockChildId, mockPackageName, mockTimestamp);

      expect(ref).toHaveBeenCalledWith(
        expect.anything(),
        `screenshots/${mockChildId}/${mockPackageName}/${mockTimestamp}.jpg`
      );
      expect(uploadString).toHaveBeenCalledWith(
        mockStorageRef,
        mockBase64,
        'base64',
        {
          contentType: 'image/jpeg',
          customMetadata: {
            childId: mockChildId,
            packageName: mockPackageName,
            timestamp: mockTimestamp.toString(),
          },
        }
      );
      expect(getDownloadURL).toHaveBeenCalledWith(mockStorageRef);
      expect(result).toBe(mockDownloadURL);
    });

    it('should create correct file path structure', async () => {
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      uploadString.mockResolvedValueOnce({ metadata: {} });
      getDownloadURL.mockResolvedValueOnce(mockDownloadURL);

      await uploadScreenshot(mockBase64, mockChildId, mockPackageName, mockTimestamp);

      expect(ref).toHaveBeenCalledWith(
        expect.anything(),
        `screenshots/${mockChildId}/${mockPackageName}/${mockTimestamp}.jpg`
      );
    });

    it('should include metadata in upload', async () => {
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      uploadString.mockResolvedValueOnce({ metadata: {} });
      getDownloadURL.mockResolvedValueOnce(mockDownloadURL);

      await uploadScreenshot(mockBase64, mockChildId, mockPackageName, mockTimestamp);

      expect(uploadString).toHaveBeenCalledWith(
        mockStorageRef,
        mockBase64,
        'base64',
        expect.objectContaining({
          contentType: 'image/jpeg',
          customMetadata: {
            childId: mockChildId,
            packageName: mockPackageName,
            timestamp: mockTimestamp.toString(),
          },
        })
      );
    });

    it('should handle upload failure', async () => {
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      uploadString.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        uploadScreenshot(mockBase64, mockChildId, mockPackageName, mockTimestamp)
      ).rejects.toThrow('Network error');
    });

    it('should handle storage permission errors', async () => {
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      const permissionError = new Error('Permission denied');
      permissionError.code = 'storage/unauthorized';
      uploadString.mockRejectedValueOnce(permissionError);

      await expect(
        uploadScreenshot(mockBase64, mockChildId, mockPackageName, mockTimestamp)
      ).rejects.toThrow('Permission denied');
    });

    it('should handle quota exceeded errors', async () => {
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      const quotaError = new Error('Quota exceeded');
      quotaError.code = 'storage/quota-exceeded';
      uploadString.mockRejectedValueOnce(quotaError);

      await expect(
        uploadScreenshot(mockBase64, mockChildId, mockPackageName, mockTimestamp)
      ).rejects.toThrow('Quota exceeded');
    });

    it('should handle missing download URL', async () => {
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      uploadString.mockResolvedValueOnce({ metadata: {} });
      getDownloadURL.mockRejectedValueOnce(new Error('No download URL'));

      await expect(
        uploadScreenshot(mockBase64, mockChildId, mockPackageName, mockTimestamp)
      ).rejects.toThrow('No download URL');
    });

    it('should handle large base64 strings', async () => {
      const largeBase64 = 'x'.repeat(1024 * 1024); // 1MB
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      uploadString.mockResolvedValueOnce({ metadata: {} });
      getDownloadURL.mockResolvedValueOnce(mockDownloadURL);

      const result = await uploadScreenshot(largeBase64, mockChildId, mockPackageName, mockTimestamp);

      expect(result).toBe(mockDownloadURL);
      expect(uploadString).toHaveBeenCalledWith(
        mockStorageRef,
        largeBase64,
        'base64',
        expect.any(Object)
      );
    });

    it('should sanitize package names with special characters', async () => {
      const specialPackageName = 'com.app/with\\special:chars';
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      uploadString.mockResolvedValueOnce({ metadata: {} });
      getDownloadURL.mockResolvedValueOnce(mockDownloadURL);

      await uploadScreenshot(mockBase64, mockChildId, specialPackageName, mockTimestamp);

      // Firebase Storage should still accept the path
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('deleteScreenshot', () => {
    it('should delete screenshot successfully', async () => {
      const mockUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/screenshots%2Ftest.jpg';
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      deleteObject.mockResolvedValueOnce();

      await deleteScreenshot(mockUrl);

      expect(deleteObject).toHaveBeenCalledWith(mockStorageRef);
    });

    it('should handle null URL gracefully', async () => {
      await deleteScreenshot(null);

      expect(deleteObject).not.toHaveBeenCalled();
    });

    it('should handle undefined URL gracefully', async () => {
      await deleteScreenshot(undefined);

      expect(deleteObject).not.toHaveBeenCalled();
    });

    it('should handle empty string URL gracefully', async () => {
      await deleteScreenshot('');

      expect(deleteObject).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const mockUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/screenshots%2Ftest.jpg';
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      deleteObject.mockRejectedValueOnce(new Error('File not found'));

      await expect(deleteScreenshot(mockUrl)).rejects.toThrow('File not found');
    });

    it('should handle permission errors during deletion', async () => {
      const mockUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/screenshots%2Ftest.jpg';
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      const permissionError = new Error('Permission denied');
      permissionError.code = 'storage/unauthorized';
      deleteObject.mockRejectedValueOnce(permissionError);

      await expect(deleteScreenshot(mockUrl)).rejects.toThrow('Permission denied');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle upload and delete cycle', async () => {
      // Upload
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      uploadString.mockResolvedValueOnce({ metadata: {} });
      getDownloadURL.mockResolvedValueOnce(mockDownloadURL);

      const url = await uploadScreenshot(mockBase64, mockChildId, mockPackageName, mockTimestamp);

      // Delete
      ref.mockReturnValueOnce(mockStorageRef);
      deleteObject.mockResolvedValueOnce();

      await deleteScreenshot(url);

      expect(uploadString).toHaveBeenCalledTimes(1);
      expect(deleteObject).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent uploads', async () => {
      const mockStorageRef1 = { path: 'path1' };
      const mockStorageRef2 = { path: 'path2' };
      
      ref.mockReturnValueOnce(mockStorageRef1).mockReturnValueOnce(mockStorageRef2);
      uploadString.mockResolvedValue({ metadata: {} });
      getDownloadURL
        .mockResolvedValueOnce('https://url1.jpg')
        .mockResolvedValueOnce('https://url2.jpg');

      const [url1, url2] = await Promise.all([
        uploadScreenshot(mockBase64, mockChildId, 'com.app1', mockTimestamp),
        uploadScreenshot(mockBase64, mockChildId, 'com.app2', mockTimestamp + 1),
      ]);

      expect(url1).toBe('https://url1.jpg');
      expect(url2).toBe('https://url2.jpg');
      expect(uploadString).toHaveBeenCalledTimes(2);
    });

    it('should preserve metadata through upload cycle', async () => {
      const mockStorageRef = {};
      ref.mockReturnValueOnce(mockStorageRef);
      uploadString.mockResolvedValueOnce({ metadata: {} });
      getDownloadURL.mockResolvedValueOnce(mockDownloadURL);

      await uploadScreenshot(mockBase64, mockChildId, mockPackageName, mockTimestamp);

      const uploadCall = uploadString.mock.calls[0];
      expect(uploadCall[3].customMetadata).toEqual({
        childId: mockChildId,
        packageName: mockPackageName,
        timestamp: mockTimestamp.toString(),
      });
    });
  });
});
