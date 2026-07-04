// The background location task MUST be defined before anything else runs,
// so a headless (killed-app) launch still has the task registered.
import './src/tracking/locationTask'

import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
