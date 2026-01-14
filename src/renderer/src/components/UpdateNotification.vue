<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'

const newVersion = ref('')
const showNotification = ref(false)

let cleanupAvailable: (() => void) | null = null

function handleOpenGitHub() {
  const url = `https://github.com/vuthanhbayit/o-ai/releases/tag/v${newVersion.value}`
  console.log('Opening GitHub releases:', url)
  window.open(url, '_blank')
}

function handleDismiss() {
  showNotification.value = false
}

function setupUpdateListeners() {
  cleanupAvailable = window.api.update.onAvailable((info) => {
    console.log('Update available:', info.version)
    newVersion.value = info.version
    showNotification.value = true
  })
}

function cleanupListeners() {
  cleanupAvailable?.()
}

onMounted(() => {
  setupUpdateListeners()
})

onUnmounted(() => {
  cleanupListeners()
})
</script>

<template>
  <Teleport to="body">
    <!-- Notification Toast -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="translate-y-[-100%] opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-[-100%] opacity-0"
    >
      <div
        v-if="showNotification"
        class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4"
      >
        <div class="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-full bg-blue-900/50">
                <Icon class="w-5 h-5 text-blue-400" icon="lucide:arrow-up-circle" />
              </div>
              <div>
                <h3 class="text-sm font-semibold text-white">Update Available</h3>
                <p class="text-xs text-gray-400">Version {{ newVersion }}</p>
              </div>
            </div>
            <button
              class="p-1 hover:bg-gray-700 rounded transition-colors"
              @click="handleDismiss"
            >
              <Icon class="w-4 h-4 text-gray-400" icon="lucide:x" />
            </button>
          </div>

          <!-- Content -->
          <div class="px-4 py-3">
            <div class="space-y-2">
              <p class="text-sm text-gray-300">A new version is available!</p>
              <p class="text-xs text-gray-400">
                Click below to download the latest release from GitHub.
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700">
            <button
              class="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
              @click="handleDismiss"
            >
              Later
            </button>
            <button
              class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors flex items-center gap-2"
              @click="handleOpenGitHub"
            >
              <Icon class="w-4 h-4" icon="lucide:external-link" />
              Download from GitHub
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
