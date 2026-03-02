// Supabase Configuration
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import config from '../config.js';

const supabaseUrl = config.supabase.url;
const supabaseKey = config.supabase.anonKey;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Auth State Management
export let currentUser = null;
export let currentProfile = null;

// Initialize auth state
export async function initAuth(onAuthChange) {
    console.log('Supabase: initAuth started');
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Supabase: getSession result', session ? 'Session found' : 'No session');

    if (session) {
        currentUser = session.user;
        console.log('Supabase: loading user profile...');
        await loadUserProfile();
        console.log('Supabase: user profile loaded');
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = session.user;
            await loadUserProfile();
        } else {
            currentUser = null;
            currentProfile = null;
        }

        // Reload page content based on auth state
        if (onAuthChange) onAuthChange();
    });
}

// Load user profile from database
async function loadUserProfile() {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (!error && data) {
        currentProfile = data;
    }
}

// Get active season
export async function getActiveSeason() {
    const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('status', 'active')
        .maybeSingle();

    return data;
}

// Check if current user is admin
export function isAdmin() {
    return currentProfile && currentProfile.role === 'admin';
}

// Sign out
export async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
}

// Upload file to Supabase Storage
export async function uploadFile(bucket, file, path) {
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file);

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

    return publicUrl;
}
