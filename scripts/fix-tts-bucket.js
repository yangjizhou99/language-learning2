require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function createBucket() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(url, serviceKey);

    console.log('Attempting to create "tts" bucket...');
    const { data, error } = await supabase.storage.createBucket('tts', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav']
    });

    if (error) {
        if (error.message.includes('already exists')) {
            console.log('Bucket "tts" already exists.');

            // Update public status just in case
            const { error: updateError } = await supabase.storage.updateBucket('tts', {
                public: true
            });
            if (updateError) console.error('Failed to update bucket public status:', updateError);
            else console.log('Bucket public status verified.');

        } else {
            console.error('Error creating bucket:', error);
            process.exit(1);
        }
    } else {
        console.log('Bucket "tts" created successfully:', data);
    }
}

createBucket();
