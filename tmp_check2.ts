import { classifyOperatorStrengthScore } from "./src/lib/bazi/constants/operator-strength";
import {
	buildDayMasterStrengthVocabulary,
	resolveCanonicalDayMasterStrengthState,
} from "./src/lib/bazi/strength-state-vocabulary";

console.log("Class for 4:", classifyOperatorStrengthScore(4));
console.log("Vocabulary for 3.75:", buildDayMasterStrengthVocabulary(3.75));
console.log("Canonical state for 6.5:", resolveCanonicalDayMasterStrengthState("6.5"));
