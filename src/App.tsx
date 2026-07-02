/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { surahCatalog } from './surahCatalog';
import { getVerseSafe } from './quranDataStore';

export default function App() {
  useEffect(() => {
    // Fire-and-forget background load
    loadQuranInBackground();
  }, []);

  const handleSurahChange = (e) => {
    const surah = parseInt(e.target.value);
    // Handle verse selection without blocking
  };

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

      {/* Verse display with loading state */}
      <div id="verseDisplay">
        {currentVerse ? (
          <div>
            <p>{currentVerse.arabic}</p>
            <p>{currentVerse.english}</p>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  );
}