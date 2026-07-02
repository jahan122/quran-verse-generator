/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { surahCatalog } from './data/surahCatalog';
import { preloadAllSurahs } from './quranStaticService';

// Preload all static surah modules once when the app starts
preloadAllSurahs().catch(err => console.warn('Failed to preload surah data', err));

export default function App() {
  return (
    <div>
      {/* Surah list rendered immediately from static catalog */}
      <select id="surahSelect">
        {surahCatalog.map(s => (
          <option key={s.id} value={s.id}>
            {s.id}. {s.arabic} ({s.english})
          </option>
        ))}
      </select>

      {/* Placeholder for verse display – UIController will update this */}
      <div id="verseDisplay">
        {/* Content will be injected by UIController */}
      </div>
    </div>
  );
}