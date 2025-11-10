package com.familyguardnew.blocker

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper

import android.os.SystemClock


import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.FrameLayout
import android.widget.TextView

class AppBlockerAccessibilityService : AccessibilityService() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var currentPackage: String? = null
  private var windowManager: WindowManager? = null
  private var overlayView: View? = null
  private var messageView: TextView? = null
  private var isOverlayVisible = false
  private var activeRule: BlockRule? = null

  private var lastForceClosePackage: String? = null
  private var lastForceCloseTimestamp: Long = 0



  override fun onServiceConnected() {
    super.onServiceConnected()
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    AppBlockerManager.registerService(this)
    serviceInfo = serviceInfo.apply {
      eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
      feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
      flags = flags or AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
    }
    Log.d(TAG, "AppBlockerAccessibilityService connected")
    handleRulesUpdated()
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return
    val packageName = event.packageName?.toString() ?: return

    if (packageName == packageName()) {
      return
    }

    if (packageName != currentPackage) {
      currentPackage = packageName
      evaluateBlocking(packageName)
    } else if (activeRule != null) {
      // refresh overlay message in case reason changed
      evaluateBlocking(packageName)
    }
  }

  override fun onInterrupt() {
    // No-op
  }

  override fun onDestroy() {
    AppBlockerManager.unregisterService(this)
    hideOverlay()
    super.onDestroy()
  }

  fun handleRulesUpdated() {
    currentPackage?.let { evaluateBlocking(it) }
  }

  private fun evaluateBlocking(packageName: String) {
    val rule = AppBlockerManager.resolve(packageName)
    if (rule != null) {
      showOverlay(rule)
    } else {
      hideOverlay()
    }
  }

  private fun showOverlay(rule: BlockRule) {

    activeRule = rule
    enforceAccessibilityBlock(rule)



    if (!Settings.canDrawOverlays(this)) {
      Log.w(TAG, "Overlay permission missing, cannot display blocker.")
      return
    }



    activeRule = rule

    mainHandler.post {
      val wm = windowManager ?: return@post
      if (overlayView == null) {
        overlayView = createOverlayView().also { view ->
          view.setOnTouchListener { _, _ -> true } // consume touches
        }
      }

      messageView?.text = rule.message

      val layoutParams = createLayoutParams()

      if (!isOverlayVisible) {
        try {
          wm.addView(overlayView, layoutParams)
          isOverlayVisible = true
        } catch (error: Throwable) {
          Log.e(TAG, "Failed to add overlay view", error)
        }
      } else {
        try {
          wm.updateViewLayout(overlayView, layoutParams)
        } catch (error: Throwable) {
          Log.e(TAG, "Failed to update overlay", error)
        }
      }
    }
  }

  private fun hideOverlay() {
    activeRule = null
    mainHandler.post {
      val wm = windowManager ?: return@post
      if (isOverlayVisible && overlayView != null) {
        try {
          wm.removeViewImmediate(overlayView)
        } catch (error: Throwable) {
          Log.e(TAG, "Failed to remove overlay view", error)
        } finally {
          isOverlayVisible = false
        }
      }
    }
  }

  private fun createOverlayView(): View {
    val container = FrameLayout(this).apply {
      setBackgroundColor(Color.parseColor("#CC111827"))
      isClickable = true
      isFocusable = true
    }

    val text = TextView(this).apply {
      setPadding(48, 48, 48, 48)
      textSize = 22f
      setTextColor(Color.WHITE)
      text = "Blocked by Parent"
      gravity = Gravity.CENTER
      setLineSpacing(1.1f, 1.2f)
    }
    messageView = text

    container.addView(
      text,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
      ).apply {
        gravity = Gravity.CENTER
      },
    )

    return container
  }

  private fun createLayoutParams(): WindowManager.LayoutParams {
    val type =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      }

    return WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      type,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_FULLSCREEN or
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.CENTER
      title = "FamilyGuard Blocker"
    }
  }

  private fun packageName(): String = applicationContext.packageName


  private fun enforceAccessibilityBlock(rule: BlockRule) {
    val target = rule.packageName
    if (target.isBlank() || target == "*" || target == packageName()) {
      return
    }

    val now = SystemClock.uptimeMillis()
    if (target == lastForceClosePackage && now - lastForceCloseTimestamp < FORCE_CLOSE_DEBOUNCE_MS) {
      return
    }
    lastForceClosePackage = target
    lastForceCloseTimestamp = now

    runCatching {
      performGlobalAction(GLOBAL_ACTION_BACK)
      mainHandler.postDelayed({ performGlobalAction(GLOBAL_ACTION_HOME) }, 150L)
    }.onFailure { error ->
      Log.w(TAG, "Failed to close blocked app via accessibility", error)
    }
  }

  companion object {
    private const val TAG = "AppBlockerService"
    private const val FORCE_CLOSE_DEBOUNCE_MS = 1200L

  companion object {
    private const val TAG = "AppBlockerService"

  }
}
