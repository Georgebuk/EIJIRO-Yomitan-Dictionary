const fs = require("fs");
const readline = require("readline");
const { combineWithSpace } = require('../../utils');
const iconv = require('iconv-lite');
const nlp = require('compromise');
const inflection = require('./inflections');
const YomitanDictionary = require("../YomitanDictionary");
nlp.plugin(require('compromise-speech'))

const testDataPath = "test_data/input.txt";
const realDataPath = "test_data/EIJIRO144-10.txt"
let dictionary;

function extractSpeechExamples(line, definition) {
    let englishExample = null;
    let japaneseExample = null;

    // Step 1: Capture everything after "■・" up until the next "■" or the end of the line
    const exampleMatch = line.match(/■・(.+?)(?=■|$)/);
    if (exampleMatch) {
        const fullExample = exampleMatch[1].trim(); // Capture everything after "■・"

        // Step 2: Capture the English part, including any quoted parts
        const englishPart = fullExample.match(/"[^"]*"/g); // Capture all quoted text (inside quotes)
        let englishText = englishPart ? englishPart.join(' ') : ''; // Combine all quoted text parts into one string

        // Step 3: Remove the English part from the original full example to get the Japanese part
        const remainingText = fullExample.replace(englishText, '').trim();
        
        // The Japanese part is what's left after the English example is removed
        japaneseExample = remainingText.trim();

        // The English part should be the combined quoted sections
        englishExample = englishText.trim();

        definition = definition.replaceAll(/■・(.+?)(?=■|$)/g, '').trim();

    }

    return { englishExample, japaneseExample, definition };
}

function processLine(line, termData){
    if (line.includes("【発音】") || line.includes("【発音！】")) { // IPA line
        const matchIpa = line.match(/^■(.+?)\s*:\s*(.*)$/); // Match term and capture all IPA data
        if (matchIpa) {
            const term = matchIpa[1].trim();
            const rawIpaData = matchIpa[2].trim(); // Capture all remaining data

            // Extract IPA-related fields from the raw data
            const ipaMatch = rawIpaData.match(/【発音.*?】(.*?)(、|$)/);
            const ipa = ipaMatch ? ipaMatch[1].trim() : null;

            const transformationsMatch = rawIpaData.match(/【変化】(.*?)(、|$)/);
            const transformations = transformationsMatch ? transformationsMatch[1].trim() : null;

            const isNoun = /《複》/.test(rawIpaData); // Check for 《複》
            const isVerb = /《動》/.test(rawIpaData); // Check for 《動》
            const isAdjective = /《形》/.test(rawIpaData); // Check for 《形》

            const wordSplitMatch = rawIpaData.match(/【分節】(.*?)(、|$)/);
            const wordSplit = wordSplitMatch ? wordSplitMatch[1].trim() : null;

            // Add processed IPA line
            if (!termData[term]) {
                termData[term] = [];
            }
            termData[term].push({
                type: "ipa",
                tag: "",
                ipa,
                transformations,
                wordSplit,
                isNoun,
                isVerb,
                isAdjective,
            });
        }
    } else { 
        const tabooMatch = line.match(/差別語|〈.*俗.*〉|〈.*卑.*〉|〈.*軽蔑.*〉/);
        const isTaboo = tabooMatch ? true : false; //Mark bad word as taboo

        const oldMatch = line.match(/〈.*古.*〉/);
        const isOld = oldMatch ? true : false; //Mark bad word as taboo

        const matchStandard = line.match(/^■(.+?)(?:\s*\{([^}]+)\})?\s*:\s*(.+)$/);
        if (matchStandard) {
            let term = matchStandard[1].trim();
            let tag = '';

            //Remove - from prefixes and suffixes so they get added as normal terms.
            //e.g. "-able" -> "able"・"poly-" -> "poly"
            term = term.replace(/^-|-$|(?<=\s)-(?=\s)/g, '');

            //Skip lines where __, ~, or possessive forms (like one's, someone's, oneself) occur in the term
            if (/__|~|one's|someone's|oneself/.test(term)) {
                return; // Ignore this line entirely
            }

            const rawTag = matchStandard[2]; // Extract raw tag if present
            let definition = matchStandard[3].trim();
            let type = 'standard';
           
            // Check for URL tag
            const urlMatch = line.match(/【URL】(.+?)($|■)/); // Matches content inside 【URL】
            const url = urlMatch ? urlMatch[1].trim() : null;
            if (url) {
                // Remove the URL text from the definition so we can add it back in later
                definition = definition.replace(/【URL】.+?($|■)/, '').trim();
            }

            // Clean up the tag (remove numbers, e.g., {形-1} → 形, {1} → '')
            if(rawTag){
                const match = rawTag.match(/[^\d\-\{\}]+/);
                tag = match ? match[0] : ''; // Handle null match
            }

            //Get example sentences from definition
            // Get example sentences from definition
            const exampleMatch = line.match(/■・(.*?)(?:\.\s*|”\s*|」\s*|$)(.*?。)((\/.*?。)*)?/);
            let [englishExample, japaneseExample] = [null, null];

            if (exampleMatch) {
                englishExample = exampleMatch[1].trim();
                japaneseExample = exampleMatch[2].trim();
                
                definition = definition.replaceAll(/■・(.*?)(?:\.\s*|”\s*|」\s*|$)(.*?。)((\/.*?。)*)?/g, '').trim();
            }

            if(!englishExample){
                examples = extractSpeechExamples(line, definition);
                if(examples.englishExample) {
                    englishExample = examples.englishExample;
                    japaneseExample = examples.japaneseExample;
                    definition = examples.definition;
                }
            }

            let region = null; // Variable to store "US" or "UK"

            // Check for explicit UK patterns (〈英〉→)
            if (definition.match(/〈英〉→/)) {
                region = "UK";
            }

            // Check for explicit US patterns (〈米〉→)
            else if (definition.match(/〈米〉→/)) {
                region = "US";
            }
            // Check for 【同】〈英〉 indicating a US term
            else if (definition.match(/【同】〈英〉/)) {
                region = "US";
            }
            // Check for 【同】〈米〉 indicating a UK term
            else if (definition.match(/【同】〈米〉/)) {
                region = "UK";
            }else if (definition.match(/^〈英〉/)) {
                region = "UK";
                definition = definition.replace(/^〈英〉/g, '').trim(); // Remove the standalone 〈英〉
            }
            // 4. Check for standalone US tag at the start of the definition
            else if (definition.match(/^〈米〉/)) {
                region = "US";
                definition = definition.replace(/^〈米〉/g, '').trim(); // Remove the standalone 〈米〉
            }

            //Catches lines that only link to another entry
            //〈英〉→behaviour -> behavior 
            const linkMatch = line.match(/→\s*([a-zA-Z\s-]+)/);
            if (linkMatch) {
                type = 'link';
                definition = definition.replace(/<→(.*?)>/g, ' $1');
            }

            // Add processed line
            if (!Array.isArray(termData[term])) {
                termData[term] = [];
            }

            termData[term].push({
                type,
                tag,
                definition,
                isTaboo,
                isOld,
                url,
                englishExample,
                japaneseExample,
                region
            });   
        }
    }
}

async function processFile(inputFile) {
    const termData = {};
    const encoding = inputFile.endsWith('.txt') && inputFile.includes('EIJIRO') ? 'Shift_JIS' : 'UTF-8';

    // Create a readable stream and decode it based on the file's encoding
    const fileStream = fs.createReadStream(inputFile);
    const decodedStream = encoding === 'Shift_JIS'
        ? fileStream.pipe(iconv.decodeStream('Shift_JIS'))
        : fileStream; // UTF-8 does not require decoding

    // Create the line reader
    const rl = readline.createInterface({
        input: decodedStream,
        crlfDelay: Infinity // Recognize all instances of CRLF as a single line break
    });

    let lineCount = 0;

    for await (const line of rl) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("■")) {
            processLine(line, termData);
            lineCount++;
            if (lineCount % 10000 === 0) {
                console.log(`${lineCount} lines processed`);
                //console.log(termData[lineCount - 1]); // Debug output for every 10,000th line
            }
        }
    }

    console.log(`Finished processing ${lineCount} lines`);
    console.log(`Total entries in termData: ${Object.keys(termData).length}`); // Output the number of entries
    return termData;
}

function createStructuredContent(olElement){
    return {
        type: "structured-content", 
        content: olElement
    };
}

function createEnglishExample(term, example, inflections) {
    const lowerCasedTerm = term.toLowerCase();
    const capitalizedTerm = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
    const upperCasedTerm = term.toUpperCase();

    const inflectedForms = inflections.map(i => i.form.toLowerCase());
    const inflectedCapitalized = inflections.map(
        i => i.form.charAt(0).toUpperCase() + i.form.slice(1).toLowerCase()
    );
    const inflectedUpperCase = inflections.map(i => i.form.toUpperCase());

    const termsToMatch = [
        lowerCasedTerm,
        capitalizedTerm,
        upperCasedTerm,
        ...inflectedForms,
        ...inflectedCapitalized,
        ...inflectedUpperCase
    ];

    const englishExample = [];
    let currentSentence = "";

    // Split by words and include punctuation (e.g., commas, periods) as separate parts
    const exampleWords = example.match(/\w+|[^\w\s]+|\s+/g);
    let matchBuffer = []; // Buffer to match multi-word terms
    let originalBuffer = []; // Preserve the original case for matching

    for (const part of exampleWords) {
        if (/\s/.test(part)) {
            // If part is a space, push it to the current sentence
            currentSentence += part;
            continue;
        }

        matchBuffer.push(part.toLowerCase());
        originalBuffer.push(part);

        const match = matchBuffer.join(" ");

        if (termsToMatch.includes(match)) {
            // Add text before the match to the example
            if (currentSentence) {
                englishExample.push({ tag: "span", content: currentSentence });
                currentSentence = "";
            }

            // Add the matched term with styling
            englishExample.push({
                tag: "span",
                style: {
                    "color": "color-mix(in srgb, lime, var(--text-color, var(--fg, #333)))"
                },
                content: originalBuffer.join(" ")
            });

            // Clear the buffers
            matchBuffer = [];
            originalBuffer = [];
        } else if (!termsToMatch.some(t => t.startsWith(match))) {
            // If there's no partial match, reset the buffers
            currentSentence += originalBuffer.join("");
            matchBuffer = [];
            originalBuffer = [];
        }
    }

    // Add any remaining text to the example
    if (currentSentence) {
        englishExample.push({ tag: "span", content: currentSentence });
    }

    return englishExample;
}


function createExampleSentence(term, englishExample, japaneseExample, inflections){
    return {
        tag: "div",
        style: { marginLeft: "0.5em" },
        data: { content: "extra-info" },
        content:{
            tag: "div",
            content: {
                tag: "div",
                style: {
                    borderStyle: "none none none solid",
                    padding: "0.5rem",
                    borderRadius: "0.4rem",
                    borderWidth: "calc(3em / var(--font-size-no-units, 14))",
                    marginTop: "0.5rem",
                    marginBottom: "0.5rem",
                    borderColor: "var(--text-color, var(--fg, #333))",
                    backgroundColor: "color-mix(in srgb, var(--text-color, var(--fg, #333)) 5%, transparent)"
                },
                data: {
                    content: "example-sentence",
                    "sentence-key": term,
                    source: "125790",
                    "source-type": "tat"
                },
                content:[
                    {
                        tag: "div",
                        style: { "fontSize": "1.3em" },
                        "data": { "content": "example-sentence-a" },
                        content: [
                            {
                                tag: "span",
                                content: createEnglishExample(term, englishExample, inflections)
                            }
                        ]
                    },
                    {
                        "tag": "div",
                        "style": { "fontSize": "0.8em" },
                        "data": { "content": "example-sentence-b" },
                        "content": japaneseExample
                    }
                ]
            }
        }
    }
}

async function* streamDictionary(lines) {
    for (const [key, value] of Object.entries(lines)) {
        yield { key, value }; // Yield one entry at a time
    }
}

function createInflectionContent(inflections, term){
    inflections.forEach((trans) => {
        let content = [
            term,
            [trans['type']]
        ];
        dictionary.addEntry(trans['form'], '', content, "non-lemma", "");
    });
}

async function createEntries(lines){
    const uniqueTags = new Set();
    let maxLines = Object.keys(lines).length;
    let curLine = 0;
    let percentage = 0;
    for await (const { key, value } of streamDictionary(lines)) {
       let inflections = inflection.createInflectionsForTerm(key, value);
        // if(!value.find((e) => e['tag'])){
        //     //inflectSentence(inflections, key);
        //     //createSentenceNounInflections(inflections, key);
        // }
        if(inflections)
            createInflectionContent(inflections, key);

        let ipaLine = value.find((e) => e['type'] == "ipa")
        let reading = ipaLine?.['wordSplit'] ?? '';
        let entryTag = value[0]?.['tag'] ?? '';
        let termTag = '';
        let olElement = {tag: "ol", content:[]};
        let sc = createStructuredContent(olElement);

        value.forEach((line, index) => {
            uniqueTags.add(line['tag']);
            //Add tag for taboo terms.
            // if(line['isTaboo'])
            //     termTag = combineWithSpace(termTag, '⚠️');
            // if(line['isOld'])
            //     termTag = combineWithSpace(termTag, '古')
            if(line['region']){
                if(line['region'] == "UK"){
                    termTag = combineWithSpace(termTag, 'UK')
                }else{
                    termTag = combineWithSpace(termTag, 'US') 
                }
            }

            // if (line['type'] == 'link'){
            //     let localLink = "?query=" + line['definition'] + "&wildcards=off";
            //     let linkContent = {tag: "a", href: localLink, content: "→" + line['definition']};
            //     let listElement = {tag: "li", content: linkContent};
            //     olElement.content.push(listElement);
            if(line['type'] == 'standard' || line['type'] == 'link'){
                //When new tag found group definitions by tag and add as entry then start a new entry
                if(line['tag'] != entryTag){
                    dictionary.addEntry(key, reading, sc, entryTag, termTag);
                    entryTag = line['tag'];
                    //reset elements for next entry
                    olElement = {tag: "ol", content:[]};
                    sc = createStructuredContent(olElement);
                }

                let olContent = [line['definition']];
                //Turn URL into a hyperlink and add it onto the list content
                if(line['url'])
                    olContent.push({ tag:"a", href: line["url"], content: line["url"] });
                if(line['englishExample'])
                    olContent.push(createExampleSentence(key, line['englishExample'], line['japaneseExample'], inflections));

                olElement.content.push({ tag: "li", content: olContent});
            } 

            //If last element in array, add current entry to dictionary
            if (index === value.length - 1) {
                dictionary.addEntry(key, reading, sc, entryTag, termTag);

                //reset elements for next entry
                olElement = {tag: "ol", content:[]};
                sc = createStructuredContent(olElement);
            }
        });
        curLine++;
        let curPerc = Math.round((100 * curLine) / maxLines);
        if(curPerc > percentage) {
            percentage = curPerc;
            console.log("Entry percentage: " + curPerc + "%");
        }
      }    
    console.log([...uniqueTags]);
}

async function createTags() {
    dictionary.addTag({
        name: '他動',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '他動詞 （英: Transative verb)',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '自動',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '自動詞 （英: Intransative verb)',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '自動・他動',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '他動詞と自動詞 (Both transative and intransative)',
        popularityScore: 0,
      });
    dictionary.addTag({
        name: '名',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '名詞 (英: Noun)',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '名・他動',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '名詞と他動詞',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '名・形',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '名詞と形容詞 (Used as a noun or adjective)',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '形',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '形容詞 （英: Adjective）',
        popularityScore: 0,
      });
      
      dictionary.addTag({
        name: '接尾',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '語構成要素の一。単独では用いられず、常に他の語の下について、その語とともに一語を形成するもの。語調を整えたり、意味を添加したりする。接辞のうち、語基よりも前に付くもの。（英: suffix）',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '接頭',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '語構成要素の一。単独では用いられず、常に他の語の下について、その語とともに一語を形成するもの。語調を整えたり、意味を添加したりする。接辞のうち、語基よりも前に付くもの。（英: prefix）',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '副',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '副詞（英: Adverb）',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '連結',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '接合，結合，連結',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '形・副',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '形容詞と副詞',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '前',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '前置詞　前置詞は、名詞や代名詞の前に置くもので、前置詞と(代)名詞で１つの「句」を作ります。「句」とは、「S+V」の構造を持たない言葉のまとまりです。（英: Preposition）',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '間投',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '感動詞（かんどうし / 英: interjection） とは、感動、応答、呼び掛けを表す。主語、述語、修飾語になることも他の語に修飾されることもない。間投詞（かんとうし）、感嘆詞（かんたんし）、嘆詞（たんし）とも言う。口語においては頻繁に用いられるが、文語において用いられることは少ない。（英: Interjection）',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '省略形',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '（英: Abbreviation）',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '接続・前',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '接続と前置詞',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '代名',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '代名詞（英: Pronoun）品詞の一つ。名詞のうち、事物の名をいわないで人･事柄･場所などを指し示すのに用いる語。「わたし」 「それ」 「ここ」など。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: 'ドメイン',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '（英: Domain）インターネット上のひとまとまりのネットワーク。国や組織などで分けられている。また、インターネット上の住所にあたるホームページアドレスやメールアドレスの文字列。ドメイン名。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '国名ドメイン',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '（英: country code top-level domain）国や地域を対象に付与されている固有のトップレベルドメイン（TLD）である。ドメイン名においてその末尾に表される。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '句他動',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '動詞＋前置詞、動詞＋副詞、または、動詞＋前置詞と副詞の両方を組み合わせて構成されたフレーズ。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '句動',
        category: 'wordPart',
        sortingOrder: -5,
        notes: '（英: Phrasal verb）「動詞+副詞」、「動詞+前置詞」、「動詞+副詞+前置詞」の結び付き で、多用な意味を表す口語的表現であり、現代英語の特徴の一つである。',
        popularityScore: 0,
      });
     dictionary.addTag({
        name: '⚠️',
        category: 'taboo',
        sortingOrder: -5,
        notes: 'この単語は差別的、または不快感を与える可能性があるため、使用には注意が必要である',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: '古',
        category: 'archaic',
        sortingOrder: -5,
        notes: '特にかしこまった、または古風な言葉である。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: 'UK',
        category: 'taboo',
        sortingOrder: -5,
        notes: 'この用語は、米国を除くほとんどの国で使われている英国の綴りを使用しています。',
        popularityScore: 0,
      });
      dictionary.addTag({
        name: 'US',
        category: 'taboo',
        sortingOrder: -5,
        notes: 'この用語は米国の綴りを使用しています。',
        popularityScore: 0,
      });
}


// Process the lines
(async () => {
    try {
        dictionary = new YomitanDictionary("test.zip");
        
        //const [inputFile, name] = [realDataPath, "英辞郎"]; 
        const [inputFile, name] = [testDataPath, "test"]; 

        await inflection.prepareInflections("noun.csv");
        const termData = await processFile(inputFile);

        dictionary.createIndex(
            name,
            'Testing EN -> JP',
            'No',
            'No'
        );

        await createEntries(termData);
        await createTags();
        dictionary.export()
    } catch (error) {
        console.error("Error reading or processing file:", error);
    }
})();