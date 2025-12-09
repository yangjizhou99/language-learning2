
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function TestDBPage() {
    const [status, setStatus] = useState('Idle');
    const [draftId, setDraftId] = useState('');

    useEffect(() => {
        // Find a draft to test with
        async function findDraft() {
            const { data } = await supabase.from('shadowing_drafts').select('id').limit(1);
            if (data && data.length > 0) {
                setDraftId(data[0].id);
            }
        }
        findDraft();
    }, []);

    async function testUpdate() {
        if (!draftId) return;
        setStatus('Updating...');
        try {
            const { data, error } = await supabase
                .from('shadowing_drafts')
                .update({ notes: { test_update: new Date().toISOString() } })
                .eq('id', draftId)
                .select();

            if (error) {
                setStatus('Error: ' + error.message);
                console.error(error);
            } else {
                setStatus('Success: ' + JSON.stringify(data));
            }
        } catch (e: any) {
            setStatus('Exception: ' + e.message);
        }
    }

    return (
        <div className="p-10">
            <h1>DB Update Test</h1>
            <p>Draft ID: {draftId}</p>
            <Button onClick={testUpdate}>Test Update</Button>
            <pre className="mt-4 p-4 bg-gray-100 rounded">{status}</pre>
        </div>
    );
}
