const fs = require('fs').promises;
const path = require('path');
const nlp = require('compromise');
nlp.plugin(require('compromise-speech'))

const nounPlurals = {};
const irregularAdjectives = {
    "good": { comparative: "better", superlative: "best" },
    "bad": { comparative: "worse", superlative: "worst" },
    "far": { comparative: "farther", superlative: "farthest" },
    "little": { comparative: "less", superlative: "least" },
    "many": { comparative: "more", superlative: "most" },
    "much": { comparative: "more", superlative: "most" },
    "old": { comparative: "older", superlative: "oldest" },
    "late": { comparative: "later", superlative: "latest" },
    "few": { comparative: "fewer", superlative: "fewest" },
};

/**
 * Generates plural and possessive forms for a given noun.
 * @param {Array} inflections - Array to store the inflections.
 * @param {string} term - The noun to be inflected.
 */
async function createNounInflections(inflections, term) {
    // Check if the term exists in the nounPlurals map
    if (nounPlurals.hasOwnProperty(term)) {
        const pluralForms = nounPlurals[term]; // Get the plural forms for the term
        
        // Add each plural form to the inflections array
        pluralForms.forEach(plural => {
            inflections.push({ type: "plural", form: plural });
        });
    } else {
        backupNounInflection(inflections, term)
    }

     // Add possessive form to the inflections array
     let possessive;
     if (term.endsWith("s")) {
         possessive = term + "'";  // Append apostrophe if the term ends with 's'
     } else {
         possessive = term + "'s";  // Append apostrophe + 's' if it doesn't
     }
 
     inflections.push({ type: "possessive", form: possessive });
}

function backupNounInflection(inflections, term) {
    const isVowel = (char) => 'aeiou'.includes(char.toLowerCase());

    // Generate plural form
    let pluralForm;
    
    // Ensure term length is at least 2 to check second-to-last character
    if (term.length < 2) {
        pluralForm = term + 's'; // Single letter words, just add 's'
    } else if (term.endsWith('y') && !isVowel(term[term.length - 2])) {
        // Nouns ending in consonant + 'y': replace 'y' with 'ies'
        pluralForm = term.slice(0, -1) + 'ies';
    } else if (term.endsWith('o') && !isVowel(term[term.length - 2])) {
        // Nouns ending in consonant + 'o': add 'es'
        pluralForm = term + 'es';
    } else if (term.endsWith('f')) {
        // Nouns ending in 'f': replace 'f' with 'ves'
        pluralForm = term.slice(0, -1) + 'ves';
    } else if (term.endsWith('fe')) {
        // Nouns ending in 'fe': replace 'fe' with 'ves'
        pluralForm = term.slice(0, -2) + 'ves';
    } else if (term.match(/(s|ss|sh|ch|x|z)$/)) {
        // Nouns ending in s, ss, sh, ch, x, or z: add 'es'
        pluralForm = term + 'es';
    } else {
        // Regular nouns: add 's'
        pluralForm = term + 's';
    }

    inflections.push({ type: "plural", form: pluralForm });
}

/**
 * Generates comparative and superlative forms for adjectives.
 * @param {Array} inflections - Array to store the inflections.
 * @param {string} term - The word to be inflected.
 */
function createAdjectiveInflections(inflections, term) {
    const doc = nlp(term);
    const syllables = doc.syllables();
    const conjugations = doc.adjectives().conjugate();

    // Check if the term is irregular
    if (irregularAdjectives[term]) {
        inflections.push(
            { type: "comparative", form: irregularAdjectives[term].comparative },
            { type: "superlative", form: irregularAdjectives[term].superlative }
        );
        return;
    }

    // Rules-based approach for regular adjectives
    const syllableCount = syllables[0].length;

    if (syllableCount === 1) {
        // Single-syllable adjectives
        if (term.endsWith("e")) {
            // Ends with 'e': just add 'r' and 'st'
            inflections.push(
                { type: "comparative", form: term + "r" },
                { type: "superlative", form: term + "st" }
            );
        } else if (/[aeiou]([bcdfghjklmnpqrstvwxyz])$/.test(term)) {
            // Ends with a single vowel + consonant (double the consonant)
            const base = term + term.slice(-1);
            inflections.push(
                { type: "comparative", form: base + "er" },
                { type: "superlative", form: base + "est" }
            );
        } else {
            // Regular single syllable
            inflections.push(
                { type: "comparative", form: term + "er" },
                { type: "superlative", form: term + "est" }
            );
        }
    } else if (syllableCount === 2) {
        // Two-syllable adjectives
        if (term.endsWith("e")) {
            // Ends with 'e': just add 'r' and 'st', and also add "more"
            // Two syllable adjectives can go either way.
            inflections.push(
                { type: "comparative", form: term + "r" },
                { type: "superlative", form: term + "st" },
                { type: "comparative", form: "more " + term },
                { type: "superlative", form: "most " + term }
            );
        } else if (term.endsWith("y")) {
            // Ends in 'y' -> replace 'y' with 'i'
            const base = term.slice(0, -1) + "i";
            inflections.push(
                { type: "comparative", form: base + "er" },
                { type: "superlative", form: base + "est" },
                { type: "comparative", form: "more " + term },
                { type: "superlative", form: "most " + term }
            );
        } else {
            // Use both "-er/-est" and "more/most" for two-syllable adjectives
            inflections.push(
                { type: "comparative", form: term + "er" },
                { type: "superlative", form: term + "est" },
                { type: "comparative", form: "more " + term },
                { type: "superlative", form: "most " + term }
            );
        }
    } else {
        // Three or more syllables
        inflections.push(
            { type: "comparative", form: "more " + term },
            { type: "superlative", form: "most " + term }
        );
    }

    let adverb = conjugations[0]?.Adverb
    if(adverb && termNotEqual(term, adverb))
        inflections.push({ type: "adverb", form: adverb});

    if(conjugations[0]?.Noun != conjugations[0]?.Adjective)
        inflections.push({ type: "noun", form: conjugations[0]?.Noun});
}

function createSentenceNounInflections(inflections, term) {
    const doc = nlp(term);
    const nouns = doc.nouns();

    if (nouns.length === 0) {
        // No nouns found; return the original term
        inflections.push({ type: "original", form: term });
        return;
    }

    // Identify the main noun (the last noun in the phrase)
    const mainNoun = nouns.slice(-1).text();

    // Pluralize the main noun if applicable
    const pluralForm = nouns.toPlural().text();

    // Handle the special case where the noun is preceded by an article or modifier
    if (pluralForm !== term) {
        // Replace the main noun with its plural form
        const updatedTerm = replaceNounWithModifiers(term, mainNoun, pluralForm);
        inflections.push({ type: "plural", form: updatedTerm });
    } else {
        inflections.push({ type: "original", form: term });
    }
}

// Helper function to replace the main noun with its plural form
function replaceNounWithModifiers(sentence, originalNoun, pluralNoun) {
    const regex = new RegExp(`\\b${originalNoun}\\b`, 'i');
    return sentence.replace(regex, pluralNoun || originalNoun);
}

function inflectSentence(inflections, term, recursiveCall){
    const words = term.split(' ');
    const verb = words[0]; // The first word is the verb
    const particle = words.slice(1).join(' '); // The rest are particles or phrasal components
    let inflectionOccured = false;

    // Inflect the verb separately
    const verbDoc = nlp(verb);
    
    let verbPast = verbDoc.verbs().toPastTense().text();
    if (verbPast && termNotEqual(term, verbPast + ' ' + particle)) {
        if (recursiveCall) verbPast = removeStartingI(verbPast);
        inflections.push({ type: "past", form: verbPast + ' ' + particle });
        inflectionOccured = true;
    }

    let verbPresent = verbDoc.verbs().toPresentTense().text();
    if (verbPresent && termNotEqual(term, verbPresent + ' ' + particle)) {
        if (recursiveCall) verbPresent = removeStartingI(verbPresent);
        inflections.push({ type: "present", form: verbPresent + ' ' + particle });
        inflectionOccured = true;
    }

    let verbFuture = verbDoc.verbs().toFutureTense().text();
    if (verbFuture && termNotEqual(term, verbFuture + ' ' + particle)) {
        if (recursiveCall) verbFuture = removeStartingI(verbFuture);
        inflections.push({ type: "future", form: verbFuture + ' ' + particle });
        inflectionOccured = true;
    }

    let verbGerund = verbDoc.verbs().toGerund().text();
    if (verbGerund && termNotEqual(term, verbGerund + ' ' + particle)) {
        if(verbGerund.toLowerCase().startsWith("is ")) //remove "is"
            verbGerund = verbGerund.slice(3);  
        inflections.push({ type: "present participle", form: verbGerund + ' ' + particle });
        inflectionOccured = true;
    }

    let verbPastParticiple = verbDoc.verbs().toPastParticiple().text();
    if (verbPastParticiple && termNotEqual(term, verbPastParticiple + ' ' + particle)) {
        if(verbPastParticiple.toLowerCase().startsWith("has ")) //remove "has"
            verbPastParticiple = verbPastParticiple.slice(4);  
        if(verbPast != verbPastParticiple){
            inflections.push({ type: "past participle", form: verbPastParticiple + ' ' + particle });
            inflectionOccured = true;
        }
    }

    if(!inflectionOccured && !recursiveCall){
        inflectSentence(inflections, "I " + term, true)
    }
}


function removeStartingI(term){
    return term.slice(2);
}

function termNotEqual(term, inflection){
    return term.toLowerCase() != inflection.toLowerCase();
}

function createVerbInflections(inflections, term){
    let newTerm = "I " + term;
    const doc = nlp(newTerm);
    const conjugations = doc.verbs().conjugate();

    if(!conjugations[0]?.PastTense && term.split(' ').length > 1){
        inflectSentence(inflections, term, false);
    }
    else{
        // Check if the form is defined before pushing it to the inflections array
        const pastTense = conjugations[0]?.PastTense;
        if (pastTense && termNotEqual(term, pastTense)) {
            inflections.push({ type: "past", form: conjugations[0].PastTense });
        }

        const gerund = conjugations[0]?.Gerund;
        if (gerund && termNotEqual(term, gerund)) {
            inflections.push({ type: "present participle", form: conjugations[0].Gerund });
        }

        const future = conjugations[0]?.FutureTense;
        if (future && termNotEqual(term, future)) {
            inflections.push({ type: "future", form: conjugations[0].FutureTense });
        }

        const presentTense = conjugations[0]?.PresentTense;
        if (presentTense && termNotEqual(term, presentTense)) {
            inflections.push({ type: "third-person singular present", form: conjugations[0].PresentTense });
        }
    }
}

async function prepareInflections(filename) {
    try {
        // Reading the CSV file asynchronously
        const data = await fs.readFile(filename, 'utf-8');
        
        const lines = data.split('\n');  // Split the data into lines
        // Iterate over each line and extract noun and plural forms
        lines.forEach(line => {
            const columns = line.split(','); // Split the line by commas

            if (columns.length >= 2) {
                const noun = columns[0].trim();
                const pluralForms = columns.slice(1).map(item => item.trim());

                nounPlurals[noun] = pluralForms;
            }
        });
    } catch (error) {
        console.error('Error reading file:', error);
        throw error;
    }
}


function createInflectionsForTerm(term, value){
    let inflections = [];
    if(value.find((e) => e['tag'] == '名'))
        createNounInflections(inflections, term);
    if(value.find((e) => e['tag'].includes('動')))
        createVerbInflections(inflections, term);
    if(value.find((e) => e['tag'].includes('形')))
        createAdjectiveInflections(inflections, term);

    return inflections;
}

// Export functions
module.exports = {
    createInflectionsForTerm,
    prepareInflections
};