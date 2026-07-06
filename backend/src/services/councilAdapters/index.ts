import { registerAdapter, registerDynamicAdapter } from './registry';
import { camdenAdapter } from './camdenParkingBaysAdapter';
import { createDynamicCouncilAdapter } from './dataGovUkCouncilAdapter';

registerAdapter(camdenAdapter);
registerDynamicAdapter(createDynamicCouncilAdapter);
