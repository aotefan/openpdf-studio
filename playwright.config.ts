import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/ui',timeout:60000,workers:1,reporter:[['list'],['json',{outputFile:'tests/results/ui.json'}]],use:{trace:'retain-on-failure'},outputDir:'tests/results/playwright'});
