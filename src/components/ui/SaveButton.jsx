import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function SaveButton({ apartmentId, onSuccess, className = '' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSaved, setIsSaved] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialCheck, setInitialCheck] = useState(true);

  // Check if apartment is already saved when component mounts
  useEffect(() => {
    const checkIfSaved = async () => {
      if (!user || !apartmentId) {
        console.log('SaveButton: Missing user or apartmentId', { userId: user?.id, apartmentId });
        setInitialCheck(false);
        return;
      }

      try {
        setLoading(true);
        console.log(`SaveButton: Checking saved status for apartment ${apartmentId} and user ${user.id}`);
        
        const { data, error } = await supabase
          .from('saved_apartments')
          .select('id')
          .eq('user_id', user.id)
          .eq('apartment_id', apartmentId);
        
        if (error) {
          console.error('Error checking saved status:', error);
          setIsSaved(false);
          setSavedId(null);
        } else if (data && data.length > 0) {
          console.log('SaveButton: Apartment is saved', data[0]);
          setIsSaved(true);
          setSavedId(data[0].id);
        } else {
          console.log('SaveButton: Apartment is not saved');
          setIsSaved(false);
          setSavedId(null);
        }
      } catch (error) {
        console.error('Unexpected error checking saved status:', error);
      } finally {
        setLoading(false);
        setInitialCheck(false);
      }
    };

    checkIfSaved();
  }, [user, apartmentId]);

  const handleToggleSave = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/apartments/${apartmentId}` } });
      return;
    }

    try {
      setLoading(true);

      if (isSaved && savedId) {
        // Unsave the apartment
        const { error } = await supabase
          .from('saved_apartments')
          .delete()
          .eq('id', savedId);
        
        if (error) throw error;
        
        console.log('SaveButton: Successfully removed apartment from saved list');
        setIsSaved(false);
        setSavedId(null);
        if (onSuccess) onSuccess(false);
      } else {
        // Save the apartment
        const { data, error } = await supabase
          .from('saved_apartments')
          .insert({
            user_id: user.id,
            apartment_id: apartmentId,
            created_at: new Date().toISOString()
          })
          .select();
        
        if (error) throw error;
        
        console.log('SaveButton: Successfully saved apartment', data);
        setIsSaved(true);
        if (data && data.length > 0) {
          setSavedId(data[0].id);
        }
        if (onSuccess) onSuccess(true);
      }
    } catch (error) {
      console.error('Error toggling saved status:', error);
      alert('Failed to save/unsave apartment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // More visible button styles
  const buttonStyle = isSaved 
    ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 dark:text-red-400 dark:border-red-800" 
    : "bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 dark:text-blue-400 dark:border-blue-800";

  return (
    <button
      onClick={handleToggleSave}
      disabled={loading || initialCheck}
      className={`px-4 py-2 rounded-lg border flex items-center space-x-2 transition-colors ${buttonStyle} ${
        (loading || initialCheck) ? 'opacity-70 cursor-not-allowed' : ''
      } ${className}`}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <svg 
          className={`h-5 w-5 ${isSaved ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} 
          fill={isSaved ? 'currentColor' : 'none'} 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
      )}
      <span>{isSaved ? 'Saved' : 'Save'}</span>
    </button>
  );
} 