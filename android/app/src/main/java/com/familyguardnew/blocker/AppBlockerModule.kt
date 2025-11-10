package com.familyguardnew.blocker

import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableMapKeySetIterator

class AppBlockerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AppBlockerModule"

  @ReactMethod
  fun updateBlockRules(data: ReadableMap?, promise: Promise?) {
    try {
      val rules = parseRules(data)
      AppBlockerManager.updateRules(rules)

      val blockedPackages = extractBlockedPackages(rules)
      val deviceOwnerActive = DeviceOwnerController.updateBlockedPackages(reactContext, blockedPackages)
      val method = resolveEnforcementMethod(if (deviceOwnerActive) true else null)
      promise?.resolve(method)

      promise?.resolve(null)

    } catch (error: Throwable) {
      Log.e(TAG, "Failed to update block rules", error)
      promise?.reject("update_error", error)
    }
  }

  @ReactMethod
  fun clearBlockRules() {
    AppBlockerManager.updateRules(BlockRules(emptyMap(), null))

    runCatching {
      DeviceOwnerController.updateBlockedPackages(reactContext, emptySet())
    }.onFailure { error ->
      Log.e(TAG, "Failed to clear device owner block list", error)
    }


  }

  @ReactMethod
  fun isAccessibilityServiceEnabled(promise: Promise) {
    try {
      val enabled = isAccessibilityEnabled()
      promise.resolve(enabled)
    } catch (error: Throwable) {
      promise.reject("accessibility_status_error", error)
    }
  }

  @ReactMethod
  fun openAccessibilitySettings() {
    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun canDrawOverlays(promise: Promise) {
    try {
      promise.resolve(Settings.canDrawOverlays(reactContext))
    } catch (error: Throwable) {
      promise.reject("overlay_status_error", error)
    }
  }

  @ReactMethod
  fun requestOverlayPermission() {
    val intent = Intent(
      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
      Uri.parse("package:${reactContext.packageName}"),
    ).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    try {
      val powerManager = reactContext.getSystemService(PowerManager::class.java)
      val ignoring =
        powerManager?.isIgnoringBatteryOptimizations(reactContext.packageName) ?: false
      promise.resolve(ignoring)
    } catch (error: Throwable) {
      promise.reject("battery_opt_status_error", error)
    }
  }

  @ReactMethod
  fun requestIgnoreBatteryOptimizations() {
    val intent = Intent(
      Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      Uri.parse("package:${reactContext.packageName}"),
    ).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun getBlockerPermissionsStatus(promise: Promise) {
    try {
      val status = Arguments.createMap().apply {
        putBoolean("accessibility", isAccessibilityEnabled())
        putBoolean("overlay", Settings.canDrawOverlays(reactContext))
        putBoolean(
          "batteryOptimization",
          isBatteryOptimizationIgnored(),
        )

        putBoolean("deviceOwner", DeviceOwnerController.hasDeviceOwnerPrivileges(reactContext))
        putString("enforcementMethod", resolveEnforcementMethod())


      }
      promise.resolve(status)
    } catch (error: Throwable) {
      promise.reject("blocker_permissions_error", error)
    }
  }

  private fun isAccessibilityEnabled(): Boolean {
    val accessibilityEnabled =
      Settings.Secure.getInt(
        reactContext.contentResolver,
        Settings.Secure.ACCESSIBILITY_ENABLED,
        0,
      )
    if (accessibilityEnabled == 0) {
      return false
    }
    val enabledServices =
      Settings.Secure.getString(
        reactContext.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
      )
    if (enabledServices.isNullOrEmpty()) {
      return false
    }

    val colonSplitter = TextUtils.SimpleStringSplitter(':')
    colonSplitter.setString(enabledServices)
    while (colonSplitter.hasNext()) {
      val componentName = colonSplitter.next()
      if (componentName.equals(
          "${reactContext.packageName}/${AppBlockerAccessibilityService::class.java.name}",
          ignoreCase = true,
        )
      ) {
        return true
      }
    }
    return false
  }

  private fun isBatteryOptimizationIgnored(): Boolean {
    val powerManager = reactContext.getSystemService(PowerManager::class.java)
    return powerManager?.isIgnoringBatteryOptimizations(reactContext.packageName) ?: false
  }


  private fun extractBlockedPackages(rules: BlockRules): Set<String> =
    rules.blockedPackages.keys
      .filter { key ->
        key.isNotBlank() && key != "*" && key != reactContext.packageName
      }
      .toSet()

  private fun resolveEnforcementMethod(deviceOwnerActive: Boolean? = null): String {
    val hasDeviceOwner =
      deviceOwnerActive ?: DeviceOwnerController.hasDeviceOwnerPrivileges(reactContext)
    return when {
      hasDeviceOwner -> "deviceOwner"
      isAccessibilityEnabled() -> "accessibility"
      Settings.canDrawOverlays(reactContext) -> "overlay"
      else -> "none"
    }
  }



  private fun parseRules(map: ReadableMap?): BlockRules {
    if (map == null || !map.hasKey("apps")) {
      return BlockRules(emptyMap(), null)
    }

    val blockedPackages = mutableMapOf<String, BlockRule>()
    var globalRule: BlockRule? = null

    if (map.hasKey("apps")) {
      val appsMap = map.getMap("apps")
      appsMap?.let { readable ->
        val iterator: ReadableMapKeySetIterator = readable.keySetIterator()
        while (iterator.hasNextKey()) {
          val key = iterator.nextKey()
          val config = readable.getMap(key) ?: continue
          if (config.hasKey("active") && config.getBoolean("active")) {
            val message =
              if (config.hasKey("message")) config.getString("message") ?: DEFAULT_BLOCK_MESSAGE
              else DEFAULT_BLOCK_MESSAGE
            val reason = if (config.hasKey("reason")) config.getString("reason") ?: "blocked" else "blocked"
            blockedPackages[key] = BlockRule(key, reason, message)
          }
        }
      }
    }

    if (map.hasKey("global")) {
      val globalMap = map.getMap("global")
      val active = globalMap?.getBoolean("active") ?: false
      if (active) {
        val message =
          if (globalMap?.hasKey("message") == true) {
            globalMap.getString("message") ?: DAILY_LIMIT_MESSAGE
          } else {
            DAILY_LIMIT_MESSAGE
          }
        val reason = globalMap?.getString("reason") ?: "dailyLimit"
        globalRule = BlockRule("*", reason, message)
      }
    }

    return BlockRules(blockedPackages, globalRule)
  }

  companion object {
    private const val TAG = "AppBlockerModule"
    private const val DEFAULT_BLOCK_MESSAGE = "Blocked by Parent"
    private const val DAILY_LIMIT_MESSAGE = "Daily Limit Reached"
  }
}
