document.addEventListener('DOMContentLoaded', () => {
    // get the required elements from the DOM
    const summarizeButton = document.getElementById('summarize');
    const summaryLevelSlider = document.getElementById('summaryLevel');
    const summaryDiv = document.getElementById('summary');
    const characterCount = document.getElementById('characterCount');
    // default complexity level
    let complexityLevel = 3;

    // Get the updated character count from the selected text
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        // Execute script to get selected text
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            function: getSelectedText
        }, (results) => {
            characterCount.textContent = "Character Count:" + results[0].result.length;
        });
    });
    
    // Update summary level display (optional visual feedback)
    summaryLevelSlider.addEventListener('input', (e) => {
        complexityLevel = e.target.value;
    });

    summarizeButton.addEventListener('click', () => {
        // Disable button during processing
        summarizeButton.disabled = true;
        summarizeButton.textContent = 'Summarizing...';
        summaryDiv.textContent = 'Summarizing...';
        summaryDiv.style.color = '#2c3e50';

        // Query for the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            // Execute script to get selected text
            chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                function: getSelectedText
            }, (results) => {
                // Get the results
                if (results && results[0] && results[0].result) {
                    const selectedText = results[0].result;

                    // Update the character count
                    characterCount.textContent = "Character Count:" + selectedText.length;

                    // Call summarization function
                    summarizeText(selectedText, complexityLevel)
                        .then(summary => {
                            summaryDiv.innerHTML = summary;
                            summaryDiv.style.color = '#2c3e50';
                        })
                        .catch(error => {
                            summaryDiv.innerHTML = "Unfortunately, the API returned an error:  " + error 
                                                    + "<br/> This could be due to the limitation of the API. Try selecting shorter text or try again later.";
                            summaryDiv.style.color = 'red';
                        })
                        .finally(() => {
                            // Re-enable button
                            summarizeButton.disabled = false;
                            summarizeButton.innerHTML = '&#10024; Summarize Selected Text';
                        });
                } else {
                    summaryDiv.textContent = "Please select some text on the page you want to summarize.";
                    summaryDiv.style.color = 'orange';
                    
                    // Re-enable button
                    summarizeButton.disabled = false;
                    summarizeButton.innerHTML = '&#10024; Summarize Selected Text';
                }
            });
        });
    });
});

function formatBulletedList(input) {
    // Split the text using *** as the delimiter
    const bulletPoints = input.split('*')
      // Remove the first element (text before the first bullet)
      .slice(1)
      // Remove the last element if it's empty or just whitespace
      .filter(point => point.trim() !== '')
      // Trim each bullet point and create the formatted list
      .map(point => `<li>${point.trim()}</li>`)
      // Join the points with newline characters
      .join('\n');
    return bulletPoints;
  }

// Function to get selected text from the page
function getSelectedText() {
    return window.getSelection().toString();
}

// Placeholder for summarization API call
async function summarizeText(text, complexity) {    
    try {
        if ('ai' in self && 'summarizer' in self.ai) {
            const options = {
                sharedContext: '',
                type: 'key-points',
                format: 'markdown',
                length: 'medium',
              };
              
              const available = (await self.ai.summarizer.capabilities()).available;
              let summarizer;
              if (available === 'no') {
                // The Summarizer API isn't usable.
                return;
              }
              if (available === 'readily') {
                // The Summarizer API can be used immediately .
                summarizer = await self.ai.summarizer.create(options);
              } else {
                // The Summarizer API can be used after the model is downloaded.
                summarizer = await self.ai.summarizer.create(options);
                summarizer.addEventListener('downloadprogress', (e) => {
                  console.log(e.loaded, e.total);
                });
                await summarizer.ready;
              }
            const context = `You are expert at explaining any text. 
                Summarize the text provided to me like I am ${complexity * 10} years old. 
                The lower the age, the simpler the summary and vice versa. 
                For younger demographics with lower reading ability summarize the text that will be easier to understand & comprehend, along with analogies and less complex technical terms.
                For older age groups with better reading abilities, summarize the text with more complex terms.
                The results should be displayed in bulleted list format.`;
            //const summary = await summarizer.summarize(text, {context: context});
            const stream = await summarizer.summarizeStreaming(text, {context: context});
            let summary = '';
            let previousChunk = '';
            const summaryDiv = document.getElementById('summary');
            for await (const chunk of stream) 
            {
                const newChunk = chunk.startsWith(previousChunk) ? chunk.slice(previousChunk.length) : chunk;
                console.log(newChunk);
                summary += newChunk;
                summaryDiv.innerHTML = "Streaming response...<br/><br/> Formatting response..."; // Add a dot to show progress
                previousChunk = chunk;
            }
            const formattedOutput = summary.indexOf("*") > -1 ? `<ul>${formatBulletedList(summary)}</ul>` : summary;
            return  formattedOutput;
        }
       
        if (!response.ok) {
            throw new Error('Summarization API call failed');
        }

        const data = await response.json();
        return data.summary;
    } catch (error) {
        console.error('Summarization error: The API call failed...', error);
        throw error;
    }
}