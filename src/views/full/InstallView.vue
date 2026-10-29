<template>
  <base-sub-nav :backButton="false" class="bg-base-300">
    <template v-slot:default>
      <base-button :disabled="isInstalling" :class="{ 'btn-primary': !installPartialFail, 'btn-subtle': installPartialFail }" to="/">
        <template v-if="isInstalling">
          {{ t('common.pleaseWait') }}
        </template>
        <template v-else-if="!installPartialFail">
          {{ t('common.continue') }} <arrow-right-icon class="w-4 h-4"/>
        </template>
        <template v-else>
          {{ t('common.continue') }} <arrow-right-icon class="w-4 h-4"/>
        </template>
      </base-button>
    </template>
    <template v-slot:title>
      <div>
        <h1 v-if="isInstalling" class="text-lg font-semibold self-center">{{ t('install.title.installing') }}</h1>
        <h1 v-else-if="installPartialFail" class="text-lg font-semibold self-center">{{ t('install.title.failed') }}</h1>
        <h1 v-else class="text-lg font-semibold self-center">{{ t('install.title.installed') }}</h1>
        <p v-if="isInstalling">{{ t('install.subtitle.installing') }}</p>
        <p v-else-if="installPartialFail">{{ t('install.subtitle.failed') }}</p>
        <p v-else>{{ t('install.subtitle.installed') }}</p>
      </div>
    </template>
  </base-sub-nav>
  <div class="flex flex-col gap-4 p-6">
    <section aria-labelledby="found-dependencies" class="rounded-box bg-base-200 p-4">
      <h2 id="found-dependencies" class="font-semibold">{{ t('install.found.title') }}</h2>
      <p class="text-sm">{{ t('install.found.hint') }}</p>
      <p v-if="foundDependencies.length === 0" class="text-sm mt-2">{{ t('install.found.empty') }}</p>
      <ul v-else class="flex flex-col gap-3 mt-3">
        <li v-for="report in foundDependencies" :key="report.tool" class="min-w-0">
          <p class="font-semibold">{{ report.tool }} <span class="font-normal text-sm">{{ t('settings.dependencies.versionSource', { version: report.active!.version, source: t(`settings.dependencies.source.${report.active!.source}`) }) }}</span></p>
          <p class="text-sm break-all">{{ report.active!.path }}</p>
        </li>
      </ul>
    </section>
    <tool-card v-for="[name, tool] in Object.entries(tools)" :key="name" :tool="tool" :name="name"/>
  </div>
</template>

<script setup lang="ts">
import { useBinariesStore } from '../../stores/binaries';
import { ArrowRightIcon } from '@heroicons/vue/24/solid';
import { computed, onMounted, ref } from 'vue';
import BaseSubNav from '../../components/base/BaseSubNav.vue';
import BaseButton from '../../components/base/BaseButton.vue';
import ToolCard from '../../components/tool-card/ToolCard.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const binariesStore = useBinariesStore();
const tools = computed(() => binariesStore.tools);
const foundDependencies = computed(() => binariesStore.dependencies.filter(report => report.active !== null));
const isInstalling = ref(true);
const installPartialFail = ref(false);

onMounted(async () => {
  await ensureBinaries();
});

const ensureBinaries = async () => {
  try {
    await binariesStore.ensure();
    isInstalling.value = false;
  } catch (e) {
    installPartialFail.value = true;
    console.error(e);
  } finally {
    isInstalling.value = false;
  }
};

</script>
