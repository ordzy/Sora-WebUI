/**
 * Sample Sora Module
 * 
 * This module demonstrates the expected interface for the Sora WebUI.
 * It assigns itself to `SoraModule` global or `module.exports`.
 */

const SampleModule = {
    name: 'Sample Module (Public)',
    version: '1.0.0',
    author: 'SoraTeam',
    description: 'A sample module loaded from public folder.',

    async search(query) {
        console.log('SampleModule searching for:', query);
        await new Promise(resolve => setTimeout(resolve, 500));

        const content = [
            {
                id: 'elephants',
                title: 'Elephants Dream',
                poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Elephants_Dream_poster.jpg/800px-Elephants_Dream_poster.jpg',
                type: 'Movie',
                description: 'The world of Elephants Dream is the infinite looping machine of Proog.'
            },
            {
                id: 'cosmos',
                title: 'Cosmos Laundromat',
                poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Cosmos_Laundromat_-_First_Cycle_-_Official_Poster.jpg/800px-Cosmos_Laundromat_-_First_Cycle_-_Official_Poster.jpg',
                type: 'Short',
                description: 'On a desolate island, a suicidal sheep named Franck meets his fate in a quirky salesman.'
            }
        ];

        if (!query) return content;
        return content.filter(c => c.title.toLowerCase().includes(query.toLowerCase()));
    },

    async getDetails(id) {
        console.log('SampleModule getting details for:', id);
        await new Promise(resolve => setTimeout(resolve, 300));

        const items = await this.search();
        const item = items.find(i => i.id === id);
        if (!item) throw new Error('Not found');

        return {
            ...item,
            episodes: [
                { id: `${id}-full`, title: 'Full Movie', number: 1 }
            ]
        };
    },

    async getStream(episodeId) {
        console.log('SampleModule getting stream for:', episodeId);
        await new Promise(resolve => setTimeout(resolve, 300));

        const streams = {
            'elephants-full': 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            'cosmos-full': 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' // Placeholder URL
        };

        return {
            url: streams[episodeId] || '',
            type: 'mp4'
        };
    }
};

// Export for the loader
if (typeof module !== 'undefined') module.exports = SampleModule;
if (typeof SoraModule !== 'undefined') SoraModule = SampleModule;
// Also return it for the eval wrapper
SampleModule;
