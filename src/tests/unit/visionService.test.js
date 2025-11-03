// src/tests/unit/visionService.test.js
const { extractSongsWithVision } = require('../../services/openaiVisionService');
const OpenAI = require('openai');
const fs = require('fs');

jest.mock('openai');
jest.mock('fs');

describe('VisionService', () => {
    let mockCreate;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCreate = jest.fn();

        // ✅ Mock du constructeur
        OpenAI.mockImplementation(() => ({
            chat: {
                completions: {
                    create: mockCreate
                }
            }
        }));
    });

    it('Doit extraire titre et artiste d\'une image', async () => {
        const mockResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        songs: [
                            { title: 'Que ce soit clair', artist: 'Paul Kalkbrenner x Stromae' },
                            { title: 'La haut', artist: 'Hugo TSR' }
                        ]
                    })
                }
            }]
        };

        const fakeBuffer = Buffer.from('fake-image-data');
        fs.readFileSync.mockReturnValue(fakeBuffer);
        mockCreate.mockResolvedValue(mockResponse);

        const result = await extractSongsWithVision('fake-path.jpg');

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            title: 'Que ce soit clair',
            artist: 'Paul Kalkbrenner x Stromae'
        });
        expect(mockCreate).toHaveBeenCalled();
    });

    it('devrait gérer les erreurs OpenAI', async () => {
        const fakeBuffer = Buffer.from('fake-image-data');
        fs.readFileSync.mockReturnValue(fakeBuffer);
        mockCreate.mockRejectedValue(new Error('API Error'));

        await expect(extractSongsWithVision('fake-path.jpg'))
            .rejects
            .toThrow('API Error');
    });

    it('devrait retourner [] si pas de JSON dans la répons', async () => {

        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: 'I cannot find any song in this image.'
                }
            }]
        });

        const result = await extractSongsWithVision('fake-path.jpg');

        expect(result).toEqual([]);
    });

    it('devrait filtrer les titres < 2 caractères', async () => {
        const fakeBuffer = Buffer.from('fake-image-data');
        fs.readFileSync.mockReturnValue(fakeBuffer);

        mockCreate.mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            songs: [
                                { title: 'A', artist: 'Invalide' },
                                { title: 'AB', artist: 'Invalide' },
                                { title: 'Valid Song', artist: 'Valid' }
                            ]
                        })
                    }
                }
            ]
        })
        const result = await extractSongsWithVision('fake-path.jpg');
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Valid Song');

    });


});