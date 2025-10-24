#!/usr/bin/env python3
"""
Script to convert video annotation files from "other devices" to "clinical materials" format.

This script processes JSON annotation files and updates the field names:
- rightPersonOtherDevices -> rightPersonClinicalMaterials
- leftPersonOtherDevices -> leftPersonClinicalMaterials

Usage:
    python update_format.py <input_directory> <output_directory>

Example:
    python update_format.py ./old_annotations ./new_annotations
"""

import json
import os
import sys
import shutil
from pathlib import Path
from typing import Dict, Any, List


def update_annotation_format(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update annotation data from old format to new format.
    
    Args:
        data: The annotation data dictionary
        
    Returns:
        Updated annotation data with new field names
    """
    # Create a deep copy to avoid modifying the original
    updated_data = json.loads(json.dumps(data))
    
    # Check if this is a valid annotation file structure
    if not isinstance(updated_data, list) or len(updated_data) < 2:
        return updated_data
    
    # Get the manual annotations section
    manual_annotations = updated_data[1].get('manualAnnotations', {})
    
    # Update field names if they exist
    if 'rightPersonOtherDevices' in manual_annotations:
        manual_annotations['rightPersonClinicalMaterials'] = manual_annotations.pop('rightPersonOtherDevices')
        print("  ✓ Updated rightPersonOtherDevices -> rightPersonClinicalMaterials")
    
    if 'leftPersonOtherDevices' in manual_annotations:
        manual_annotations['leftPersonClinicalMaterials'] = manual_annotations.pop('leftPersonOtherDevices')
        print("  ✓ Updated leftPersonOtherDevices -> leftPersonClinicalMaterials")
    
    return updated_data


def process_json_file(input_path: Path, output_path: Path) -> bool:
    """
    Process a single JSON annotation file.
    
    Args:
        input_path: Path to input JSON file
        output_path: Path to output JSON file
        
    Returns:
        True if file was processed successfully, False otherwise
    """
    try:
        # Read the input file
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Update the format
        updated_data = update_annotation_format(data)
        
        # Create output directory if it doesn't exist
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write the updated file
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(updated_data, f, indent=2, ensure_ascii=False)
        
        return True
        
    except json.JSONDecodeError as e:
        print(f"  ❌ Error parsing JSON: {e}")
        return False
    except Exception as e:
        print(f"  ❌ Error processing file: {e}")
        return False


def process_directory(input_dir: Path, output_dir: Path) -> None:
    """
    Process all JSON files in the input directory.
    
    Args:
        input_dir: Input directory path
        output_dir: Output directory path
    """
    if not input_dir.exists():
        print(f"❌ Input directory does not exist: {input_dir}")
        return
    
    if not input_dir.is_dir():
        print(f"❌ Input path is not a directory: {input_dir}")
        return
    
    # Find all JSON files
    json_files = list(input_dir.glob("*.json"))
    
    if not json_files:
        print(f"⚠️  No JSON files found in {input_dir}")
        return
    
    print(f"📁 Processing {len(json_files)} JSON files from {input_dir}")
    print(f"📁 Output directory: {output_dir}")
    print()
    
    successful = 0
    failed = 0
    
    for json_file in json_files:
        print(f"🔄 Processing: {json_file.name}")
        
        # Create output path maintaining directory structure
        relative_path = json_file.relative_to(input_dir)
        output_path = output_dir / relative_path
        
        if process_json_file(json_file, output_path):
            successful += 1
            print(f"  ✅ Successfully processed")
        else:
            failed += 1
            print(f"  ❌ Failed to process")
        
        print()
    
    # Summary
    print("=" * 50)
    print("📊 CONVERSION SUMMARY")
    print("=" * 50)
    print(f"✅ Successfully processed: {successful} files")
    print(f"❌ Failed to process: {failed} files")
    print(f"📁 Output directory: {output_dir}")
    
    if successful > 0:
        print("\n🎉 Conversion completed! Your annotation files now use 'clinical materials' instead of 'other devices'.")
        print("   You can now use these updated files with the new video annotation tool.")


def main():
    """Main function to handle command line arguments and execute conversion."""
    if len(sys.argv) != 3:
        print("Usage: python update_format.py <input_directory> <output_directory>")
        print()
        print("This script converts annotation files from 'other devices' to 'clinical materials' format.")
        print()
        print("Arguments:")
        print("  input_directory   Directory containing JSON annotation files to convert")
        print("  output_directory  Directory where converted files will be saved")
        print()
        print("Example:")
        print("  python update_format.py ./old_annotations ./new_annotations")
        sys.exit(1)
    
    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    
    print("🔄 Video Annotation Format Converter")
    print("=" * 50)
    print("Converting 'other devices' -> 'clinical materials'")
    print()
    
    process_directory(input_dir, output_dir)


if __name__ == "__main__":
    main()
