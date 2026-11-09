import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/ui',timeout:process.platform==='win32'?120000:60000,expect:{timeout:process.platform==='win32'?15000:5000},workers:1,reporter:[['list'],['json',{outputFile:'tests/results/ui.json'}]],use:{trace:'retain-on-failure'},outputDir:'tests/results/playwright'});
