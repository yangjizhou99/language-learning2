import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os

# Ensure output directory exists
OUTPUT_DIR = 'docs/paper/charts'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Set global style for academic publication
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Arial', 'DejaVu Sans']
plt.rcParams['font.size'] = 12
plt.rcParams['axes.linewidth'] = 1.5
plt.rcParams['lines.linewidth'] = 2

def generate_system_architecture():
    """
    Chart 1: System Architecture Diagram (Flowchart)
    Visualizes the data flow: User -> Analysis -> Tracing -> Generation -> User
    """
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis('off')

    # Define box styles
    box_style = dict(boxstyle='round,pad=0.5', facecolor='white', edgecolor='black', linewidth=2)
    
    # Draw nodes
    # User
    ax.text(1, 3, 'User\nInteraction', ha='center', va='center', size=12, bbox=box_style)
    
    # NLP Pipeline Container
    rect = patches.Rectangle((2.5, 1), 5, 4, linewidth=1, edgecolor='gray', facecolor='#f0f0f0', linestyle='--')
    ax.add_patch(rect)
    ax.text(5, 5.2, 'NLP & AI Core Pipeline', ha='center', va='center', size=14, weight='bold', color='gray')

    # Components
    ax.text(5, 4, 'Morphological\nAnalysis\n(Tokenization)', ha='center', va='center', size=12, bbox=box_style)
    ax.text(5, 2.5, 'Knowledge Tracing\n(DKVMN Model)', ha='center', va='center', size=12, bbox=box_style)
    ax.text(5, 1, 'Generative AI\n(LLM Prompting)', ha='center', va='center', size=12, bbox=box_style)
    
    # Output
    ax.text(9, 3, 'Personalized\nContent', ha='center', va='center', size=12, bbox=box_style)

    # Draw arrows
    arrow_props = dict(arrowstyle='->', linewidth=2, color='black')
    
    # User -> Analysis
    ax.annotate('', xy=(3.8, 4), xytext=(1.8, 3.2), arrowprops=arrow_props)
    
    # Analysis -> Tracing
    ax.annotate('', xy=(5, 3.1), xytext=(5, 3.4), arrowprops=arrow_props)
    
    # Tracing -> Generation
    ax.annotate('', xy=(5, 1.6), xytext=(5, 1.9), arrowprops=arrow_props)
    
    # Generation -> Output
    ax.annotate('', xy=(8.2, 2.8), xytext=(6.2, 1), arrowprops=arrow_props)
    
    # Output -> User (Feedback Loop)
    ax.annotate('', xy=(1, 2.4), xytext=(9, 2.4), arrowprops=dict(arrowstyle='->', linewidth=2, color='black', connectionstyle="arc3,rad=-0.2"))
    ax.text(5, 0.2, 'Feedback Loop (Next Exercise)', ha='center', va='center', size=10, style='italic')

    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'Figure1_System_Architecture.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print("Generated Figure 1: System Architecture")

def generate_dkvmn_schematic():
    """
    Chart 2: DKVMN Mechanism Schematic
    Visualizes Key Matrix, Value Matrix, and Read/Write operations.
    """
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis('off')

    # Input Embedding (kt)
    ax.text(1, 4, '$k_t$\n(Input)', ha='center', va='center', size=12, bbox=dict(boxstyle='circle', facecolor='#e6f3ff', edgecolor='black'))

    # Key Matrix (Mk)
    rect_mk = patches.Rectangle((3, 5), 2, 2.5, linewidth=2, edgecolor='black', facecolor='#fff2cc')
    ax.add_patch(rect_mk)
    ax.text(4, 6.25, '$M_k$\n(Key Matrix)', ha='center', va='center', size=12)
    
    # Value Matrix (Mv)
    rect_mv = patches.Rectangle((3, 1), 2, 2.5, linewidth=2, edgecolor='black', facecolor='#d9ead3')
    ax.add_patch(rect_mv)
    ax.text(4, 2.25, '$M_v$\n(Value Matrix)', ha='center', va='center', size=12)

    # Attention Weights (wt)
    ax.text(4, 4.25, '$w_t$\n(Attention)', ha='center', va='center', size=10, bbox=dict(boxstyle='round', facecolor='white', edgecolor='gray'))

    # Operations
    # Read
    ax.text(8, 2.25, 'Read Process\n$r_t = \Sigma w_t M_v$', ha='center', va='center', size=11, bbox=dict(boxstyle='round', facecolor='white', edgecolor='black'))
    
    # Write
    ax.text(8, 5, 'Write Process\n$M_v \leftarrow M_v(1-w_t e_t) + w_t a_t$', ha='center', va='center', size=11, bbox=dict(boxstyle='round', facecolor='white', edgecolor='black'))

    # Arrows
    arrow_props = dict(arrowstyle='->', linewidth=1.5, color='black')
    
    # kt -> Mk
    ax.annotate('', xy=(3, 6), xytext=(1.5, 4.5), arrowprops=arrow_props)
    
    # Mk -> wt
    ax.annotate('', xy=(4, 4.8), xytext=(4, 5), arrowprops=arrow_props)
    
    # wt -> Mv (Read)
    ax.annotate('', xy=(4, 3.5), xytext=(4, 4), arrowprops=arrow_props)
    
    # Mv -> Read Process
    ax.annotate('', xy=(6.5, 2.25), xytext=(5, 2.25), arrowprops=arrow_props)
    
    # Update loop (Write)
    ax.annotate('', xy=(5, 1.5), xytext=(8, 4.5), arrowprops=dict(arrowstyle='->', linewidth=1.5, color='black', connectionstyle="arc3,rad=-0.3"))

    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'Figure2_DKVMN_Mechanism.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print("Generated Figure 2: DKVMN Mechanism")

def generate_nlp_pipeline_detail():
    """
    Chart 3: Morphological Analysis & Profiling Pipeline
    Visualizes the specific NLP steps: Tokenization -> Lemmatization -> Level Mapping -> Profiling.
    This is a factual representation of the lexProfileAnalyzer.ts logic.
    """
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 8)
    ax.axis('off')

    # Define box styles
    box_style = dict(boxstyle='round,pad=0.5', facecolor='white', edgecolor='black', linewidth=1.5)
    data_style = dict(boxstyle='round,pad=0.3', facecolor='#e6f3ff', edgecolor='blue', linewidth=1)
    
    # 1. Input
    ax.text(1.5, 7, 'Input Text\n(Japanese/English)', ha='center', va='center', size=11, bbox=data_style)
    
    # 2. Tokenization
    ax.text(5, 7, 'Tokenizer\n(Kuromoji / Budoux)', ha='center', va='center', size=11, bbox=box_style)
    
    # 3. Tokens Data
    ax.text(8.5, 7, 'Tokens\n[t1, t2, t3...]', ha='center', va='center', size=11, bbox=data_style)
    
    # 4. Parallel Processing
    # Branch A: Vocabulary
    ax.text(3, 5, 'Lemmatization\n(Base Form)', ha='center', va='center', size=11, bbox=box_style)
    ax.text(3, 3.5, 'Dictionary Lookup\n(JLPT/CEFR)', ha='center', va='center', size=11, bbox=box_style)
    
    # Branch B: Grammar
    ax.text(7, 5, 'Pattern Matching\n(Regex/Rules)', ha='center', va='center', size=11, bbox=box_style)
    ax.text(7, 3.5, 'Grammar Dictionary\n(YAPAN/Hagoromo)', ha='center', va='center', size=11, bbox=box_style)
    
    # 5. Aggregation
    ax.text(5, 2, 'Level Profiling\n(N1-N5 Distribution)', ha='center', va='center', size=11, bbox=box_style)
    
    # 6. Output
    ax.text(5, 0.5, 'Difficulty Vector\n{N1: 10%, N2: 20%...}', ha='center', va='center', size=11, bbox=data_style)

    # Arrows
    arrow_props = dict(arrowstyle='->', linewidth=1.5, color='black')
    
    # Input -> Tokenizer
    ax.annotate('', xy=(3.5, 7), xytext=(2.5, 7), arrowprops=arrow_props)
    
    # Tokenizer -> Tokens
    ax.annotate('', xy=(7.5, 7), xytext=(6.5, 7), arrowprops=arrow_props)
    
    # Tokens -> Lemma (Branch A)
    ax.annotate('', xy=(3, 5.5), xytext=(8.5, 6.5), arrowprops=dict(arrowstyle='->', linewidth=1.5, color='black', connectionstyle="arc3,rad=-0.2"))
    
    # Tokens -> Pattern (Branch B)
    ax.annotate('', xy=(7, 5.5), xytext=(8.5, 6.5), arrowprops=dict(arrowstyle='->', linewidth=1.5, color='black', connectionstyle="arc3,rad=0.2"))
    
    # Branch A Flow
    ax.annotate('', xy=(3, 4), xytext=(3, 4.5), arrowprops=arrow_props)
    ax.annotate('', xy=(4, 2.5), xytext=(3, 3), arrowprops=arrow_props)
    
    # Branch B Flow
    ax.annotate('', xy=(7, 4), xytext=(7, 4.5), arrowprops=arrow_props)
    ax.annotate('', xy=(6, 2.5), xytext=(7, 3), arrowprops=arrow_props)
    
    # Profiling -> Output
    ax.annotate('', xy=(5, 1), xytext=(5, 1.5), arrowprops=arrow_props)

    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, 'Figure3_NLP_Pipeline.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print("Generated Figure 3: NLP Pipeline")

if __name__ == "__main__":
    generate_system_architecture()
    generate_dkvmn_schematic()
    generate_nlp_pipeline_detail()
    print(f"All charts generated in {OUTPUT_DIR}")
