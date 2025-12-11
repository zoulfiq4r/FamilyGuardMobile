package com.familyguardnew;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class ScreenCaptureModule extends ReactContextBaseJavaModule implements ActivityEventListener {
    private static final String MODULE_NAME = "ScreenCaptureModule";
    private static final int REQUEST_MEDIA_PROJECTION = 1001;

    private MediaProjectionManager projectionManager;
    private MediaProjection mediaProjection;
    private ImageReader imageReader;
    private VirtualDisplay virtualDisplay;
    private Promise capturePromise;
    private int screenWidth;
    private int screenHeight;
    private int screenDensity;

    public ScreenCaptureModule(ReactApplicationContext context) {
        super(context);
        context.addActivityEventListener(this);
        projectionManager = (MediaProjectionManager) context.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        
        WindowManager windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        DisplayMetrics metrics = new DisplayMetrics();
        windowManager.getDefaultDisplay().getRealMetrics(metrics);
        screenWidth = metrics.widthPixels;
        screenHeight = metrics.heightPixels;
        screenDensity = metrics.densityDpi;
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void requestPermission(Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Activity not available");
            return;
        }

        try {
            // Start foreground service FIRST (required for MediaProjection)
            Intent serviceIntent = new Intent(activity, ScreenCaptureService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(serviceIntent);
            } else {
                activity.startService(serviceIntent);
            }

            // Now request permission
            capturePromise = promise;
            Intent intent = projectionManager.createScreenCaptureIntent();
            activity.startActivityForResult(intent, REQUEST_MEDIA_PROJECTION);
        } catch (Exception e) {
            promise.reject("PERMISSION_ERROR", "Failed to request permission: " + e.getMessage());
            capturePromise = null;
        }
    }

    @ReactMethod
    public void captureScreen(Promise promise) {
        if (mediaProjection == null) {
            promise.reject("NO_PERMISSION", "Screen capture permission not granted. Call requestPermission() first.");
            return;
        }

        try {
            captureScreenshot(promise);
        } catch (Exception e) {
            promise.reject("CAPTURE_ERROR", "Failed to capture screen: " + e.getMessage());
            // If capture failed due to timeout/reuse, reset the projection so next attempt can request fresh permission
            if (e.getMessage() != null && (e.getMessage().contains("Don't re-use") || e.getMessage().contains("timed out"))) {
                mediaProjection = null;
                promise.reject("PROJECTION_EXPIRED", "MediaProjection token expired. Please request permission again.");
            }
        }
    }

    @ReactMethod
    public void stopCapture(Promise promise) {
        try {
            cleanup();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STOP_ERROR", "Failed to stop capture: " + e.getMessage());
        }
    }

    private void captureScreenshot(Promise promise) {
        // Clean up previous virtual display and image reader
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }

        imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2);
        
        virtualDisplay = mediaProjection.createVirtualDisplay(
            "ScreenCapture",
            screenWidth,
            screenHeight,
            screenDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(),
            null,
            null
        );

        // Wait for the virtual display to render (increased from 500ms to 800ms for stability)
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                Image image = imageReader.acquireLatestImage();
                if (image == null) {
                    // If no image available, try with acquireNextImage
                    image = imageReader.acquireNextImage();
                    if (image == null) {
                        promise.reject("NO_IMAGE", "Failed to acquire image");
                        // Clean up on failure
                        if (virtualDisplay != null) {
                            virtualDisplay.release();
                            virtualDisplay = null;
                        }
                        return;
                    }
                }

                Bitmap bitmap = imageToBitmap(image);
                image.close();

                // Convert to base64
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, 80, baos);
                byte[] bytes = baos.toByteArray();
                String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

                WritableMap result = Arguments.createMap();
                result.putString("base64", base64);
                result.putInt("width", bitmap.getWidth());
                result.putInt("height", bitmap.getHeight());
                result.putInt("size", bytes.length);

                bitmap.recycle();
                promise.resolve(result);
                
            } catch (Exception e) {
                promise.reject("CONVERSION_ERROR", "Failed to convert image: " + e.getMessage());
            } finally {
                // Always clean up virtual display after capture
                if (virtualDisplay != null) {
                    virtualDisplay.release();
                    virtualDisplay = null;
                }
            }
        }, 800);
    }

    private Bitmap imageToBitmap(Image image) {
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer buffer = planes[0].getBuffer();
        int pixelStride = planes[0].getPixelStride();
        int rowStride = planes[0].getRowStride();
        int rowPadding = rowStride - pixelStride * screenWidth;

        Bitmap bitmap = Bitmap.createBitmap(
            screenWidth + rowPadding / pixelStride,
            screenHeight,
            Bitmap.Config.ARGB_8888
        );
        bitmap.copyPixelsFromBuffer(buffer);

        return Bitmap.createBitmap(bitmap, 0, 0, screenWidth, screenHeight);
    }

    private void cleanup() {
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }
        
        // Stop the foreground service
        Activity activity = getCurrentActivity();
        if (activity != null) {
            Intent serviceIntent = new Intent(activity, ScreenCaptureService.class);
            activity.stopService(serviceIntent);
        }
    }

    @Override
    public void onActivityResult(Activity activity, int requestCode, int resultCode, @Nullable Intent data) {
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                mediaProjection = projectionManager.getMediaProjection(resultCode, data);
                
                // Register callback (required for Android 14+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    mediaProjection.registerCallback(new MediaProjection.Callback() {
                        @Override
                        public void onStop() {
                            cleanup();
                        }
                    }, new Handler(Looper.getMainLooper()));
                }
                
                if (capturePromise != null) {
                    capturePromise.resolve(true);
                    capturePromise = null;
                }
            } else {
                if (capturePromise != null) {
                    capturePromise.reject("PERMISSION_DENIED", "User denied screen capture permission");
                    capturePromise = null;
                }
            }
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        // Not needed
    }

    @Override
    public void onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy();
        cleanup();
    }
}
