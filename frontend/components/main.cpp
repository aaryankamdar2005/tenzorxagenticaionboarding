#include <iostream>
#include <string>

using namespace std;

// 1. A barebones node structure
struct TrieNode {
    TrieNode* child[26] = {nullptr}; // Automatically sets all 26 pointers to null
    bool isWord = false;             // Automatically sets to false
};

// 2. The Trie containing just Insert and Search
struct Trie {
    TrieNode* root = new TrieNode();

    void insert(string word) {
        TrieNode* curr = root;
        
        for (char c : word) {
            int idx = c - 'a';
            
            // If the path doesn't exist, create it
            if (curr->child[idx] == nullptr) {
                curr->child[idx] = new TrieNode();
            }
            // Move to the next node
            curr = curr->child[idx];
        }
        // Mark the end of the word
        curr->isWord = true;
    }

    bool search(string word) {
        TrieNode* curr = root;
        
        for (char c : word) {
            int idx = c - 'a';
            
            // If the path breaks, the word isn't here
            if (curr->child[idx] == nullptr) {
                return false;
            }
            // Move to the next node
            curr = curr->child[idx];
        }
        // Return true only if it's actually marked as the end of a word
        return curr->isWord;
    }
};

// --- Quick Test ---
int main() {
    Trie t;
    
    t.insert("apple");
    t.insert("app");

    cout << t.search("apple") << "\n"; // Outputs 1 (true)
    cout << t.search("app") << "\n";   // Outputs 1 (true)
    cout << t.search("bat") << "\n";   // Outputs 0 (false)

    return 0;
}