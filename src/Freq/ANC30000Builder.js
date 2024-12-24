const fs = require('fs'); 
const csv = require('csv-parser');
const YomitanDictionary = require("../YomitanDictionary");

let dictionary;
//Array of categories we don't want to mark as priority words
//1 = Country name
//2 = City/place
//4 = US States
//96 = Company/Brand names
//98 = Names of people
const nonPriorityCategories = [1, 2, 4, 96, 98];

function isPriority(frequency, category){
    if(nonPriorityCategories.includes(category))
        return false;

    return frequency <= 9000
}

// Function to read and process the CSV file without headers
async function extractWordData(filePath) {
    fs.createReadStream(filePath)
        .pipe(csv({ headers: false }))  // Disable headers
        .on('data', (row) => {
            // Assign variables based on the index of each value in the row
            const lemma = row[0];           // Index 0 corresponds to Lemma
            const rank = row[1];            // Index 1 corresponds to Rank
            const frequency = row[2];       // Index 2 corresponds to Frequency
            const japaneseShort = row[3];  // Index 3 corresponds to Short
            const commentary = row[4];     // Index 4 corresponds to Commentary
                                            //Index 5 is unnecessary
            const category = row[6];       // Index 6 corresponds to Category

            let tag = ''
            if(isPriority(rank, Number(category)))
                tag = '⭐️'
            // Process the data
            dictionary.addEntry(lemma, '', commentary, '', tag);
            dictionary.addMetaTag(lemma, Number(rank));
        })
        .on('end', () => {
            dictionary.addTag("⭐️",
                "popular",
                -100,
                "Is a high priority term",
                0
            );
            dictionary.export();
            console.log('File processing complete.');
        })
        .on('error', (error) => {
            console.error('Error processing the file:', error);
        });
}

const filePath = "potential_dictionaries/ANC30000_1014_Dic.csv";

(async () => {
    try {
        dictionary = new YomitanDictionary("ANC30000.zip");
        dictionary.setIndex(
            "ANC30000",
            "米国のAmerican National Corpus(言語統計)コンソーシアムは1990年以降新聞・テレビ・ネット・SNSから音声まで、あらゆる分野で使用された米単語30万種を、「単語頻度統計.Word Frequency List」として世界に公開されたものです。",
            "Jam Systems Inc.",
            "https://www.jamsystem.com/ancdic/index.html"
        );  
    
        await extractWordData(filePath);    
    } catch (error) {
        console.error("Error reading or processing file:", error);
    }
})();
