// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with logging
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials:', {
    url: supabaseUrl ? 'defined' : 'missing', 
    key: supabaseKey ? 'defined' : 'missing'
  });
}

// Create client
export const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
);

/**
 * Store job description embedding in vector database
 */
export async function storeJobDescriptionEmbedding(
  recordId: string,
  jobTitle: string,
  jobDescription: string,
  embedding: number[],
  interviewLength?: number,
  customInstructions?: string
) {
  console.log('Attempting to store JD embedding:', { recordId, jobTitle });
  
  try {
    const { data, error } = await supabase
      .from('jd_embeddings')
      .insert({
        record_id: recordId,
        job_title: jobTitle,
        job_description: jobDescription,
        embedding,
        interview_length: interviewLength,
        custom_instructions: customInstructions
      })
      .select('id');

    if (error) {
      console.error('Error storing job description embedding:', error);
      return null;
    }
    
    console.log('Successfully stored JD embedding:', data);
    return data;
  } catch (error) {
    console.error('Exception storing job description embedding:', error);
    return null;
  }
}

/**
 * Store question embedding in vector database
 */
export async function storeQuestionEmbedding(
  questionId: string,
  content: string,
  skillName: string,
  skillLevel: string,
  requirement: string,
  embedding: number[],
  liked?: boolean
) {
  console.log('Attempting to store question embedding:', { questionId, skillName });
  
  try {
    const { data, error } = await supabase
      .from('question_embeddings')
      .insert({
        question_id: questionId,
        content,
        embedding,
        skill_name: skillName,
        skill_level: skillLevel,
        requirement,
        liked
      })
      .select('id');

    if (error) {
      console.error('Error storing question embedding:', error);
      return null;
    }
    
    console.log('Successfully stored question embedding:', data);
    return data;
  } catch (error) {
    console.error('Exception storing question embedding:', error);
    return null;
  }
}

/**
 * Find similar job descriptions based on vector similarity
 */
export async function findSimilarJobDescriptions(
  embedding: number[],
  threshold: number = 0.7,
  maxResults: number = 5
) {
  try {
    const { data, error } = await supabase.rpc(
      'find_similar_jds',
      {
        query_embedding: embedding,
        similarity_threshold: threshold,
        max_results: maxResults
      }
    );

    if (error) {
      console.error('Error finding similar job descriptions:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception finding similar job descriptions:', error);
    return [];
  }
}

/**
 * Find best questions for given job description skills
 */
export async function findBestQuestions(
  embedding: number[],
  skillNames: string[],
  maxQuestions: number = 10
) {
  try {
    const { data, error } = await supabase.rpc(
      'find_best_questions',
      {
        query_embedding: embedding,
        skill_names: skillNames,
        max_questions: maxQuestions
      }
    );

    if (error) {
      console.error('Error finding best questions:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception finding best questions:', error);
    return [];
  }
}