/**
 * Standard Interface for Sora Modules
 * 
 * This is a documentation-only file to describe the expected API.
 * Real modules should implement these methods.
 */

export class ModuleInterface {
    /**
     * Search for content.
     * @param {string} query - The search query.
     * @returns {Promise<Array<{id: string, title: string, poster: string, type: string}>>}
     */
    async search(query) {
        throw new Error('Not implemented');
    }

    /**
     * Get details for a specific content item.
     * @param {string} id - The content ID.
     * @returns {Promise<{id: string, title: string, description: string, poster: string, episodes: Array<{id: string, title: string, number: number}>}>}
     */
    async getDetails(id) {
        throw new Error('Not implemented');
    }

    /**
     * Get the stream URL for an episode.
     * @param {string} episodeId - The episode ID.
     * @returns {Promise<{url: string, type: 'hls'|'mp4'}>}
     */
    async getStream(episodeId) {
        throw new Error('Not implemented');
    }
}
