import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

// Initialize PostHog globally
posthog.init('phc_FbHQoWVTN5sgsa1OBu6WUdFJ2Mcgq9FgRn1msSO0FgM', {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    session_recording: {
        maskAllInputs: true, // CRITICAL for NHS: Masks text inputs so you don't record patient data
    }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </React.StrictMode>
);
