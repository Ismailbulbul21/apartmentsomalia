import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function WriteReview() {
  const { apartmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [apartment, setApartment] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Fetch apartment details
  useEffect(() => {
    const fetchApartment = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('apartments')
          .select('id, title, location_description')
          .eq('id', apartmentId)
          .single();
        
        if (error) throw error;
        
        setApartment(data);
      } catch (error) {
        console.error('Error fetching apartment:', error);
        setError('Could not load the apartment details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchApartment();
  }, [apartmentId]);
  
  // Check if user already reviewed this apartment
  useEffect(() => {
    const checkExistingReview = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('id')
          .eq('apartment_id', apartmentId)
          .eq('user_id', user.id)
          .single();
        
        if (data) {
          setError('You have already reviewed this apartment');
        }
      } catch (error) {
        // No review found, which is fine
      }
    };
    
    checkExistingReview();
  }, [apartmentId, user]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user || !apartmentId) {
      setError('You must be logged in to leave a review');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      // Insert the review
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          apartment_id: apartmentId,
          user_id: user.id,
          rating,
          comment,
          created_at: new Date().toISOString(),
        })
        .select();
      
      if (error) throw error;
      
      setSuccess(true);
      
      // Redirect to the apartment page after a short delay
      setTimeout(() => {
        navigate(`/apartments/${apartmentId}`);
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting review:', error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-gray-600">Loading apartment details...</p>
          </div>
        ) : error && !success ? (
          <div className="p-6">
            <div className="bg-red-100 text-red-700 p-4 rounded-md mb-4">
              <p>{error}</p>
            </div>
            <Link to={`/apartments/${apartmentId}`} className="text-blue-600 hover:underline">
              &larr; Back to apartment
            </Link>
          </div>
        ) : success ? (
          <div className="p-6">
            <div className="bg-green-100 text-green-700 p-4 rounded-md mb-4">
              <p className="font-bold">Thank you for your review!</p>
              <p>Your review has been submitted successfully.</p>
            </div>
            <p className="text-gray-600 mb-4">You will be redirected to the apartment page shortly...</p>
            <Link to={`/apartments/${apartmentId}`} className="text-blue-600 hover:underline">
              &larr; Back to apartment
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-gray-50 p-6 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-800">Write a Review</h1>
              <p className="text-gray-600">Share your experience with this apartment</p>
            </div>
            
            {apartment && (
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-1">{apartment.title}</h2>
                  <p className="text-gray-600">{apartment.location_description}</p>
                </div>
                
                <form onSubmit={handleSubmit}>
                  <div className="mb-6">
                    <label className="block text-gray-700 font-semibold mb-2">
                      Rating
                    </label>
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="focus:outline-none"
                        >
                          <svg 
                            className={`w-8 h-8 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'} cursor-pointer mr-1`}
                            fill="currentColor" 
                            viewBox="0 0 20 20" 
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </button>
                      ))}
                      <span className="ml-2 text-gray-600">{rating}/5</span>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <label htmlFor="comment" className="block text-gray-700 font-semibold mb-2">
                      Your Review
                    </label>
                    <textarea
                      id="comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={6}
                      placeholder="Share details about your experience with this apartment..."
                      required
                    ></textarea>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Link 
                      to={`/apartments/${apartmentId}`}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 